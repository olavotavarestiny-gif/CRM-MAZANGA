#!/usr/bin/env python3
"""Generate the KukuGest Food operating manual from the canonical guide JSON."""

from __future__ import annotations

import json
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    KeepTogether,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "frontend" / "src" / "content" / "food-guide.json"
OUTPUT = ROOT / "output" / "pdf" / "kukugest-food-manual-v1.pdf"

PAGE_WIDTH, PAGE_HEIGHT = A4
NAVY = colors.HexColor("#102A43")
INK = colors.HexColor("#1F2933")
MUTED = colors.HexColor("#627D98")
LINE = colors.HexColor("#D9E2EC")
SURFACE = colors.HexColor("#F5F7FA")
GREEN = colors.HexColor("#16845B")
GREEN_SOFT = colors.HexColor("#E8F6EF")
AMBER = colors.HexColor("#A35B00")
AMBER_SOFT = colors.HexColor("#FFF6E5")
BLUE = colors.HexColor("#276FBF")
BLUE_SOFT = colors.HexColor("#EAF3FC")


def register_fonts() -> None:
    font_dir = Path("/System/Library/Fonts/Supplemental")
    pdfmetrics.registerFont(TTFont("KukuRegular", str(font_dir / "Arial.ttf")))
    pdfmetrics.registerFont(TTFont("KukuBold", str(font_dir / "Arial Bold.ttf")))


def safe(text: str) -> str:
    return (
        str(text)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


class GuideDocument(BaseDocTemplate):
    def __init__(self, filename: str, version: str, **kwargs):
        self.version = version
        super().__init__(filename, **kwargs)

    def afterFlowable(self, flowable):
        if isinstance(flowable, Paragraph) and flowable.style.name == "TopicTitle":
            key = f"topic-{flowable.getPlainText()}"
            self.canv.bookmarkPage(key)
            self.canv.addOutlineEntry(flowable.getPlainText(), key, level=0, closed=False)


def draw_page(canvas, doc) -> None:
    canvas.saveState()
    page = canvas.getPageNumber()
    if page > 1:
        canvas.setStrokeColor(LINE)
        canvas.line(18 * mm, PAGE_HEIGHT - 15 * mm, PAGE_WIDTH - 18 * mm, PAGE_HEIGHT - 15 * mm)
        canvas.setFont("KukuBold", 8)
        canvas.setFillColor(NAVY)
        canvas.drawString(18 * mm, PAGE_HEIGHT - 11.5 * mm, "KUKUGEST FOOD")
        canvas.setFont("KukuRegular", 8)
        canvas.setFillColor(MUTED)
        canvas.drawRightString(PAGE_WIDTH - 18 * mm, PAGE_HEIGHT - 11.5 * mm, f"Manual {doc.version}")
        canvas.setStrokeColor(LINE)
        canvas.line(18 * mm, 14 * mm, PAGE_WIDTH - 18 * mm, 14 * mm)
        canvas.setFont("KukuRegular", 8)
        canvas.drawString(18 * mm, 9.5 * mm, "Uso operacional e formação interna")
        canvas.drawRightString(PAGE_WIDTH - 18 * mm, 9.5 * mm, f"Página {page}")
    canvas.restoreState()


def build_styles():
    styles = getSampleStyleSheet()
    return {
        "cover_brand": ParagraphStyle(
            "CoverBrand", parent=styles["Normal"], fontName="KukuBold", fontSize=12,
            leading=14, textColor=colors.white, spaceAfter=18 * mm,
        ),
        "cover_title": ParagraphStyle(
            "CoverTitle", parent=styles["Title"], fontName="KukuBold", fontSize=31,
            leading=35, textColor=colors.white, alignment=TA_LEFT, spaceAfter=7 * mm,
        ),
        "cover_copy": ParagraphStyle(
            "CoverCopy", parent=styles["Normal"], fontName="KukuRegular", fontSize=13,
            leading=20, textColor=colors.HexColor("#D9EAF7"), spaceAfter=24 * mm,
        ),
        "cover_meta": ParagraphStyle(
            "CoverMeta", parent=styles["Normal"], fontName="KukuBold", fontSize=9,
            leading=14, textColor=colors.white,
        ),
        "h1": ParagraphStyle(
            "SectionTitle", parent=styles["Heading1"], fontName="KukuBold", fontSize=22,
            leading=27, textColor=NAVY, spaceAfter=5 * mm,
        ),
        "topic": ParagraphStyle(
            "TopicTitle", parent=styles["Heading1"], fontName="KukuBold", fontSize=20,
            leading=25, textColor=NAVY, spaceAfter=3 * mm,
        ),
        "eyebrow": ParagraphStyle(
            "Eyebrow", parent=styles["Normal"], fontName="KukuBold", fontSize=8,
            leading=10, textColor=BLUE, spaceAfter=2 * mm,
        ),
        "lead": ParagraphStyle(
            "Lead", parent=styles["Normal"], fontName="KukuRegular", fontSize=11,
            leading=17, textColor=MUTED, spaceAfter=5 * mm,
        ),
        "body": ParagraphStyle(
            "Body", parent=styles["Normal"], fontName="KukuRegular", fontSize=9.5,
            leading=14.5, textColor=INK,
        ),
        "body_bold": ParagraphStyle(
            "BodyBold", parent=styles["Normal"], fontName="KukuBold", fontSize=9.5,
            leading=14, textColor=INK,
        ),
        "small": ParagraphStyle(
            "Small", parent=styles["Normal"], fontName="KukuRegular", fontSize=8,
            leading=12, textColor=MUTED,
        ),
        "callout": ParagraphStyle(
            "Callout", parent=styles["Normal"], fontName="KukuBold", fontSize=9.5,
            leading=14, textColor=INK,
        ),
    }


def callout(label, text, style, background, accent):
    content = Paragraph(f"<font color='{accent.hexval()}'><b>{safe(label).upper()}</b></font><br/>{safe(text)}", style)
    table = Table([[content]], colWidths=[165 * mm])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), background),
        ("BOX", (0, 0), (-1, -1), 0.7, accent),
        ("LEFTPADDING", (0, 0), (-1, -1), 11),
        ("RIGHTPADDING", (0, 0), (-1, -1), 11),
        ("TOPPADDING", (0, 0), (-1, -1), 9),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
    ]))
    return table


def build_pdf() -> None:
    register_fonts()
    data = json.loads(SOURCE.read_text(encoding="utf-8"))
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    styles = build_styles()

    frame = Frame(18 * mm, 18 * mm, PAGE_WIDTH - 36 * mm, PAGE_HEIGHT - 36 * mm, id="content")
    doc = GuideDocument(
        str(OUTPUT),
        version=data["version"],
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=20 * mm,
        bottomMargin=19 * mm,
        title=data["title"],
        author="KukuGest",
        subject="Manual operacional do workspace KukuGest Food",
    )
    doc.addPageTemplates([PageTemplate(id="guide", frames=[frame], onPage=draw_page)])

    story = []
    cover = Table([
        [Paragraph("KUKUGEST FOOD", styles["cover_brand"])],
        [Paragraph("Manual de utilização", styles["cover_title"])],
        [Paragraph(safe(data["description"]), styles["cover_copy"])],
        [Paragraph(
            f"VERSÃO {safe(data['version'])}<br/>Actualizado em {safe(data['updatedAt'])}<br/>Gestão, Caixa, Cozinha, Delivery, Entregador e CRM &amp; Marketing",
            styles["cover_meta"],
        )],
    ], colWidths=[174 * mm], rowHeights=[32 * mm, None, None, 38 * mm])
    cover.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), NAVY),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 15 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 15 * mm),
        ("TOPPADDING", (0, 0), (-1, -1), 12 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 12 * mm),
        ("LINEBELOW", (0, 0), (-1, 0), 3, GREEN),
    ]))
    story.extend([Spacer(1, 12 * mm), cover, PageBreak()])

    story.extend([
        Paragraph("Como usar este manual", styles["h1"]),
        Paragraph(
            "Este documento acompanha a operação desde a configuração inicial até à análise. "
            "Cada tópico identifica quem executa a tarefa, o resultado esperado, o passo a passo e os cuidados necessários.",
            styles["lead"],
        ),
        callout("Regra principal", "Trabalhe sempre na organização e unidade correctas. No ambiente online, cada colaborador deve utilizar apenas a sua conta e função.", styles["callout"], BLUE_SOFT, BLUE),
        Spacer(1, 7 * mm),
        Paragraph("Fluxo completo", styles["h1"]),
    ])
    flow_rows = []
    for index, item in enumerate(data["flow"], 1):
        flow_rows.append([
            Paragraph(str(index), ParagraphStyle("FlowNumber", parent=styles["body_bold"], alignment=TA_CENTER, textColor=colors.white)),
            Paragraph(safe(item), styles["body_bold"]),
        ])
    flow_table = Table(flow_rows, colWidths=[12 * mm, 153 * mm])
    flow_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), NAVY),
        ("BACKGROUND", (1, 0), (1, -1), SURFACE),
        ("BOX", (0, 0), (-1, -1), 0.5, LINE),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.white),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (1, 0), (1, -1), 10),
    ]))
    story.extend([flow_table, Spacer(1, 8 * mm), Paragraph("Funções", styles["h1"])])
    role_rows = [[Paragraph("FUNÇÃO", styles["body_bold"]), Paragraph("RESPONSABILIDADE", styles["body_bold"])]]
    for role in data["roles"]:
        role_rows.append([Paragraph(safe(role["label"]), styles["body_bold"]), Paragraph(safe(role["description"]), styles["body"])])
    role_table = Table(role_rows, colWidths=[38 * mm, 127 * mm], repeatRows=1)
    role_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, SURFACE]),
        ("GRID", (0, 0), (-1, -1), 0.5, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]))
    story.extend([role_table, PageBreak()])

    role_labels = {role["id"]: role["label"] for role in data["roles"]}
    current_section = None
    for topic_index, topic in enumerate(data["topics"], 1):
        if current_section != topic["section"]:
            current_section = topic["section"]
            story.extend([
                Paragraph(safe(current_section).upper(), styles["eyebrow"]),
                Paragraph(f"{topic_index:02d}. {safe(topic['title'])}", styles["topic"]),
            ])
        else:
            story.extend([
                Spacer(1, 3 * mm),
                Paragraph(safe(current_section).upper(), styles["eyebrow"]),
                Paragraph(f"{topic_index:02d}. {safe(topic['title'])}", styles["topic"]),
            ])

        roles = " · ".join(role_labels[role] for role in topic["roles"])
        story.extend([
            Paragraph(safe(topic["summary"]), styles["lead"]),
            Table([
                [Paragraph(f"<b>QUEM USA</b><br/>{safe(roles)}", styles["small"]),
                 Paragraph(f"<b>ÁREA</b><br/>{safe(topic['route'])}", styles["small"])],
            ], colWidths=[92 * mm, 73 * mm], style=TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), SURFACE),
                ("BOX", (0, 0), (-1, -1), 0.5, LINE),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, LINE),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 9),
                ("RIGHTPADDING", (0, 0), (-1, -1), 9),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ])),
            Spacer(1, 3 * mm),
            callout("Resultado esperado", topic["outcome"], styles["callout"], GREEN_SOFT, GREEN),
            Spacer(1, 4 * mm),
            Paragraph("PASSO A PASSO", styles["eyebrow"]),
        ])

        for step_index, step in enumerate(topic["steps"], 1):
            number = Paragraph(str(step_index), ParagraphStyle("StepNumber", parent=styles["body_bold"], alignment=TA_CENTER, textColor=colors.white))
            text = Paragraph(f"<b>{safe(step['title'])}</b><br/>{safe(step['description'])}", styles["body"])
            block = Table([[number, text]], colWidths=[10 * mm, 155 * mm], style=TableStyle([
                ("BACKGROUND", (0, 0), (0, 0), NAVY),
                ("BOX", (0, 0), (-1, -1), 0.5, LINE),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (0, 0), 3),
                ("RIGHTPADDING", (0, 0), (0, 0), 3),
                ("LEFTPADDING", (1, 0), (1, 0), 9),
                ("RIGHTPADDING", (1, 0), (1, 0), 9),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]))
            story.extend([KeepTogether([block]), Spacer(1, 1.5 * mm)])

        for tip in topic["tips"]:
            story.extend([Spacer(1, 2 * mm), callout("Dica", tip, styles["body"], BLUE_SOFT, BLUE)])
        for warning in topic["warnings"]:
            story.extend([Spacer(1, 2 * mm), callout("Atenção", warning, styles["body"], AMBER_SOFT, AMBER)])

        if topic_index < len(data["topics"]):
            story.append(PageBreak())

    story.extend([
        PageBreak(),
        Paragraph("Primeiro teste recomendado", styles["h1"]),
        Paragraph("Antes de convidar utilizadores externos, execute o fluxo completo com dados sintéticos e uma única unidade.", styles["lead"]),
    ])
    checklist = [
        "Confirmar marca, moeda, fuso horário e unidade principal.",
        "Criar colaboradores para Gestor, Caixa, Cozinha, Delivery e Entregador.",
        "Configurar códigos pessoais sem os incluir em evidências ou documentos.",
        "Criar categoria, produto disponível, extras, ingredientes e ficha técnica.",
        "Abrir turno e Caixa, criar pedido e enviá-lo à Cozinha.",
        "Concluir a preparação, atribuir entrega e confirmar PIN.",
        "Reconciliar cobrança, fechar Caixa e terminar turno.",
        "Validar relatórios e remover ou encerrar todos os dados de teste.",
    ]
    for index, item in enumerate(checklist, 1):
        story.extend([
            Table([[Paragraph(str(index), styles["body_bold"]), Paragraph(safe(item), styles["body"])]], colWidths=[10 * mm, 155 * mm], style=TableStyle([
                ("BACKGROUND", (0, 0), (0, 0), GREEN_SOFT),
                ("BOX", (0, 0), (-1, -1), 0.5, LINE),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("ALIGN", (0, 0), (0, 0), "CENTER"),
                ("LEFTPADDING", (1, 0), (1, 0), 9),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ])),
            Spacer(1, 1.5 * mm),
        ])
    story.extend([
        Spacer(1, 7 * mm),
        callout("Suporte dentro da aplicação", "Abra Food > Ajuda para pesquisar este conteúdo, filtrar por função e entrar directamente em cada área.", styles["callout"], BLUE_SOFT, BLUE),
    ])

    doc.build(story)
    print(f"Generated {OUTPUT}")


if __name__ == "__main__":
    build_pdf()
