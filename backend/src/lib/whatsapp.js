const axios = require('axios');

const WHATSAPP_API_URL = `https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

const headers = {
  Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
  'Content-Type': 'application/json',
};

async function sendTextMessage(phone, text) {
  try {
    const response = await axios.post(
      WHATSAPP_API_URL,
      {
        messaging_product: 'whatsapp',
        to: phone,
        type: 'text',
        text: { body: text },
      },
      { headers }
    );
    console.log('WhatsApp message sent:', response.data);
    return response.data;
  } catch (error) {
    const metaError = error.response?.data?.error;
    const msg = metaError
      ? `WhatsApp API Error ${metaError.code}: ${metaError.message}`
      : error.message;
    console.error('Error sending WhatsApp message:', msg);
    const err = new Error(msg);
    err.statusCode = error.response?.status;
    throw err;
  }
}

async function sendTemplate(phone, templateName, languageCode = 'pt_BR') {
  try {
    const response = await axios.post(
      WHATSAPP_API_URL,
      {
        messaging_product: 'whatsapp',
        to: phone,
        type: 'template',
        template: {
          name: templateName,
          language: { code: languageCode },
        },
      },
      { headers }
    );
    console.log('WhatsApp template sent:', response.data);
    return response.data;
  } catch (error) {
    const metaError = error.response?.data?.error;
    const msg = metaError
      ? `WhatsApp API Error ${metaError.code}: ${metaError.message}`
      : error.message;
    console.error('Error sending WhatsApp template:', msg);
    const err = new Error(msg);
    err.statusCode = error.response?.status;
    throw err;
  }
}

async function getTemplates() {
  try {
    const TEMPLATES_API_URL = `https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION}/${process.env.WABA_ID}/message_templates`;

    const response = await axios.get(TEMPLATES_API_URL, { headers });

    // Formatar resposta: retornar array de templates com name, language, status
    const templates = (response.data.data || []).map((template) => ({
      name: template.name,
      language: template.language,
      status: template.status,
    }));

    console.log('Templates fetched:', templates.length);
    return templates;
  } catch (error) {
    console.error('Error fetching templates:', error.response?.data || error.message);
    throw error;
  }
}

module.exports = {
  sendTextMessage,
  sendTemplate,
  getTemplates,
};
