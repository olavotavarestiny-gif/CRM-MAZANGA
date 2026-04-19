'use strict';
const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { checkLimit, getAllUsage } = require('../lib/plan-limits');
const { requirePermission } = require('../lib/permissions');

// Helper: resolve orgId for the current user
function getOrgId(req) {
  return req.user.effectiveUserId;
}

// Helper: build channel response with unread count for a specific user
async function buildChannelResponse(channel, userId) {
  const membership = channel.members.find((m) => m.userId === userId);
  const lastReadAt = membership?.lastReadAt || new Date(0);

  const unreadCount = await prisma.chatMessage.count({
    where: {
      channelId: channel.id,
      senderId: { not: userId },
      createdAt: { gt: lastReadAt },
    },
  });

  const lastMessage = await prisma.chatMessage.findFirst({
    where: { channelId: channel.id },
    orderBy: { createdAt: 'desc' },
    include: { sender: { select: { name: true } } },
  });

  const members = channel.members.map((m) => ({
    userId: m.userId,
    name: m.user?.name || '',
    email: m.user?.email || '',
  }));

  return {
    id: channel.id,
    name: channel.name,
    description: channel.description,
    type: channel.type,
    orgId: channel.orgId,
    createdById: channel.createdById,
    createdAt: channel.createdAt,
    members,
    unreadCount,
    lastMessage: lastMessage
      ? {
          text: lastMessage.text,
          createdAt: lastMessage.createdAt,
          senderName: lastMessage.sender?.name || '',
        }
      : null,
  };
}

async function getChannelWithMembers(channelId, orgId) {
  return prisma.chatChannel.findFirst({
    where: { id: channelId, orgId },
    include: {
      members: { include: { user: { select: { name: true, email: true } } } },
    },
  });
}

function canManageChannel(req, channel) {
  if (!channel || channel.type !== 'channel') return false;
  if (req.user.isSuperAdmin || req.user.role === 'admin' || req.user.isAccountOwner) return true;
  return channel.createdById === req.user.id && channel.members.some((member) => member.userId === req.user.id);
}

async function getValidOrgMemberIds(orgId, memberIds) {
  const members = await prisma.user.findMany({
    where: {
      active: true,
      OR: [{ id: orgId }, { accountOwnerId: orgId }],
      id: { in: memberIds },
    },
    select: { id: true },
  });

  return members.map((member) => member.id);
}

// GET /api/chat/channels
router.get('/channels', requirePermission('chat', 'view'), async (req, res) => {
  try {
    const orgId = getOrgId(req);
    const userId = req.user.id;

    const channels = await prisma.chatChannel.findMany({
      where: {
        orgId,
        members: { some: { userId } },
      },
      include: {
        members: { include: { user: { select: { name: true, email: true } } } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const result = await Promise.all(channels.map((c) => buildChannelResponse(c, userId)));
    res.json(result);
  } catch (err) {
    console.error('GET /chat/channels error:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// POST /api/chat/channels
router.post('/channels', requirePermission('chat', 'edit'), async (req, res) => {
  try {
    const orgId = getOrgId(req);
    const userId = req.user.id;
    const { name, description, memberIds = [] } = req.body;

    if (!name?.trim()) return res.status(400).json({ error: 'Nome é obrigatório' });

    const { allowed, current, limit, plan } = await checkLimit(orgId, 'channels');
    if (!allowed) {
      return res.status(429).json({
        error: `Limite de canais atingido (${current}/${limit}) no plano ${plan}`,
        current,
        limit,
        plan,
        feature: 'channels',
      });
    }

    // Ensure creator is always a member
    const allMemberIds = Array.from(new Set([userId, ...memberIds]));

    const channel = await prisma.chatChannel.create({
      data: {
        orgId,
        name: name.trim(),
        description: description?.trim() || null,
        type: 'channel',
        createdById: userId,
        members: {
          create: allMemberIds.map((uid) => ({ userId: uid })),
        },
      },
      include: {
        members: { include: { user: { select: { name: true, email: true } } } },
      },
    });

    const result = await buildChannelResponse(channel, userId);
    res.status(201).json(result);
  } catch (err) {
    console.error('POST /chat/channels error:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// POST /api/chat/dm
router.post('/dm', requirePermission('chat', 'edit'), async (req, res) => {
  try {
    const orgId = getOrgId(req);
    const userId = req.user.id;
    const { targetUserId } = req.body;

    if (!targetUserId) return res.status(400).json({ error: 'targetUserId é obrigatório' });

    // Check if DM already exists between these two users in this org
    const existing = await prisma.chatChannel.findFirst({
      where: {
        orgId,
        type: 'dm',
        AND: [
          { members: { some: { userId } } },
          { members: { some: { userId: targetUserId } } },
        ],
      },
      include: {
        members: { include: { user: { select: { name: true, email: true } } } },
      },
    });

    if (existing) {
      const result = await buildChannelResponse(existing, userId);
      return res.json(result);
    }

    // Get target user name for DM channel name
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { name: true },
    });

    const channel = await prisma.chatChannel.create({
      data: {
        orgId,
        name: targetUser?.name || `DM-${targetUserId}`,
        type: 'dm',
        createdById: userId,
        members: {
          create: [{ userId }, { userId: targetUserId }],
        },
      },
      include: {
        members: { include: { user: { select: { name: true, email: true } } } },
      },
    });

    const result = await buildChannelResponse(channel, userId);
    res.status(201).json(result);
  } catch (err) {
    console.error('POST /chat/dm error:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// GET /api/chat/channels/:id/messages
router.get('/channels/:id/messages', requirePermission('chat', 'view'), async (req, res) => {
  try {
    const orgId = getOrgId(req);
    const userId = req.user.id;
    const { id: channelId } = req.params;
    const { before, limit: limitParam = '50' } = req.query;
    const limit = Math.min(parseInt(limitParam, 10) || 50, 100);

    // Verify membership
    const membership = await prisma.chatChannelMember.findUnique({
      where: { channelId_userId: { channelId, userId } },
    });
    if (!membership) return res.status(403).json({ error: 'Sem acesso a este canal' });

    const where = { channelId };
    if (before) {
      const refMsg = await prisma.chatMessage.findUnique({ where: { id: before }, select: { createdAt: true } });
      if (refMsg) where.createdAt = { lt: refMsg.createdAt };
    }

    const messages = await prisma.chatMessage.findMany({
      where,
      include: { sender: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // Return oldest first
    res.json(messages.reverse().map((m) => ({
      id: m.id,
      channelId: m.channelId,
      senderId: m.senderId,
      senderName: m.sender?.name || '',
      senderEmail: m.sender?.email || '',
      text: m.text,
      attachments: JSON.parse(m.attachments || '[]'),
      mentions: JSON.parse(m.mentions || '[]'),
      createdAt: m.createdAt,
    })));
  } catch (err) {
    console.error('GET /chat/channels/:id/messages error:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// POST /api/chat/channels/:id/messages
router.post('/channels/:id/messages', requirePermission('chat', 'edit'), async (req, res) => {
  try {
    const orgId = getOrgId(req);
    const userId = req.user.id;
    const { id: channelId } = req.params;
    const { text, attachments = [], mentions = [] } = req.body;

    if (!text?.trim() && attachments.length === 0) {
      return res.status(400).json({ error: 'Mensagem não pode estar vazia' });
    }

    // Verify membership
    const membership = await prisma.chatChannelMember.findUnique({
      where: { channelId_userId: { channelId, userId } },
    });
    if (!membership) return res.status(403).json({ error: 'Sem acesso a este canal' });

    // Check daily message limit
    const { allowed, current, limit, plan } = await checkLimit(orgId, 'messagesPerDay');
    if (!allowed) {
      return res.status(429).json({
        error: `Limite diário de mensagens atingido (${current}/${limit}) no plano ${plan}`,
        current,
        limit,
        plan,
        feature: 'messagesPerDay',
      });
    }

    const message = await prisma.chatMessage.create({
      data: {
        channelId,
        senderId: userId,
        text: text?.trim() || '',
        attachments: JSON.stringify(attachments),
        mentions: JSON.stringify(mentions),
      },
      include: { sender: { select: { id: true, name: true, email: true } } },
    });

    // Mark as read for sender
    await prisma.chatChannelMember.update({
      where: { channelId_userId: { channelId, userId } },
      data: { lastReadAt: new Date() },
    });

    res.status(201).json({
      id: message.id,
      channelId: message.channelId,
      senderId: message.senderId,
      senderName: message.sender?.name || '',
      senderEmail: message.sender?.email || '',
      text: message.text,
      attachments: JSON.parse(message.attachments || '[]'),
      mentions: JSON.parse(message.mentions || '[]'),
      createdAt: message.createdAt,
    });
  } catch (err) {
    console.error('POST /chat/channels/:id/messages error:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// POST /api/chat/channels/:id/read
router.post('/channels/:id/read', requirePermission('chat', 'view'), async (req, res) => {
  try {
    const userId = req.user.id;
    const { id: channelId } = req.params;

    await prisma.chatChannelMember.updateMany({
      where: { channelId, userId },
      data: { lastReadAt: new Date() },
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('POST /chat/channels/:id/read error:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// GET /api/chat/unread
router.get('/unread', requirePermission('chat', 'view'), async (req, res) => {
  try {
    const orgId = getOrgId(req);
    const userId = req.user.id;

    const memberships = await prisma.chatChannelMember.findMany({
      where: { userId, channel: { orgId } },
      select: { channelId: true, lastReadAt: true },
    });

    let total = 0;
    for (const m of memberships) {
      const count = await prisma.chatMessage.count({
        where: {
          channelId: m.channelId,
          senderId: { not: userId },
          createdAt: { gt: m.lastReadAt || new Date(0) },
        },
      });
      total += count;
    }

    res.json({ unread: total });
  } catch (err) {
    console.error('GET /chat/unread error:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// GET /api/chat/users — list org members for @mentions, channel creation, and task assignment
router.get('/users', async (req, res) => {
  try {
    const orgId = getOrgId(req);

    // The org consists of: the account owner + all members with accountOwnerId = orgId
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { id: orgId },
          { accountOwnerId: orgId },
        ],
        active: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        accountOwnerId: true,
        isSuperAdmin: true,
      },
      orderBy: { name: 'asc' },
    });

    res.json(users);
  } catch (err) {
    console.error('GET /chat/users error:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// GET /api/chat/limits
router.get('/limits', requirePermission('chat', 'view'), async (req, res) => {
  try {
    const orgId = getOrgId(req);
    const data = await getAllUsage(orgId);
    res.json(data);
  } catch (err) {
    console.error('GET /chat/limits error:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// PATCH /api/chat/channels/:id
router.patch('/channels/:id', requirePermission('chat', 'edit'), async (req, res) => {
  try {
    const orgId = getOrgId(req);
    const userId = req.user.id;
    const { id: channelId } = req.params;
    const { name, description, memberIds } = req.body;

    const channel = await getChannelWithMembers(channelId, orgId);
    if (!channel) return res.status(404).json({ error: 'Canal não encontrado' });
    if (channel.type !== 'channel') return res.status(400).json({ error: 'Só canais de grupo podem ser geridos' });
    if (!canManageChannel(req, channel)) return res.status(403).json({ error: 'Sem permissão para gerir este canal' });

    const updateData = {};
    if (name !== undefined) {
      if (!String(name).trim()) return res.status(400).json({ error: 'Nome é obrigatório' });
      updateData.name = String(name).trim();
    }
    if (description !== undefined) {
      updateData.description = String(description).trim() || null;
    }

    let finalMemberIds;
    if (memberIds !== undefined) {
      if (!Array.isArray(memberIds)) {
        return res.status(400).json({ error: 'memberIds deve ser uma lista' });
      }

      finalMemberIds = Array.from(new Set(memberIds.map((memberId) => parseInt(memberId, 10)).filter(Number.isInteger)));
      if (finalMemberIds.length === 0) {
        return res.status(400).json({ error: 'O canal precisa de pelo menos um membro' });
      }

      const validMemberIds = await getValidOrgMemberIds(orgId, finalMemberIds);
      if (validMemberIds.length !== finalMemberIds.length) {
        return res.status(400).json({ error: 'Existem membros inválidos para esta conta' });
      }
    }

    await prisma.$transaction(async (tx) => {
      if (Object.keys(updateData).length > 0) {
        await tx.chatChannel.update({
          where: { id: channelId },
          data: updateData,
        });
      }

      if (finalMemberIds) {
        await tx.chatChannelMember.deleteMany({
          where: {
            channelId,
            userId: { notIn: finalMemberIds },
          },
        });

        await tx.chatChannelMember.createMany({
          data: finalMemberIds.map((memberId) => ({ channelId, userId: memberId })),
          skipDuplicates: true,
        });
      }
    });

    const updatedChannel = await getChannelWithMembers(channelId, orgId);
    const result = await buildChannelResponse(updatedChannel, userId);
    res.json(result);
  } catch (err) {
    console.error('PATCH /chat/channels/:id error:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// DELETE /api/chat/channels/:id
router.delete('/channels/:id', requirePermission('chat', 'edit'), async (req, res) => {
  try {
    const orgId = getOrgId(req);
    const { id: channelId } = req.params;

    const channel = await getChannelWithMembers(channelId, orgId);
    if (!channel) return res.status(404).json({ error: 'Canal não encontrado' });
    if (channel.type !== 'channel') return res.status(400).json({ error: 'Só canais de grupo podem ser eliminados' });
    if (!canManageChannel(req, channel)) return res.status(403).json({ error: 'Sem permissão para gerir este canal' });

    await prisma.chatChannel.delete({ where: { id: channelId } });
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /chat/channels/:id error:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

module.exports = router;
