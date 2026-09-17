const express = require('express');
const router = express.Router();
const { chatComplete } = require('../services/textProvider');
const { chatRateLimit } = require('../middleware/rateLimit');

/**
 * POST /api/chat
 * Body: { messages: [{role, content}], context: string }
 */
router.post('/chat', chatRateLimit, async (req, res) => {
  try {
    const { messages, context } = req.body;
    
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ success: false, error: 'Invalid messages format' });
    }

    // BUG 8: validate + bound the payload before it reaches the AI provider
    const cleanMessages = messages
      .filter((m) => m && typeof m.content === 'string' && ['user', 'model', 'assistant'].includes(m.role))
      .slice(-20)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));

    if (cleanMessages.length === 0) {
      return res.status(400).json({ success: false, error: 'Chat messages must be {role, content} objects (max 20 turns, 2000 chars each).' });
    }

    const { text: reply, provider } = await chatComplete(
      cleanMessages,
      context || 'You are Kisan Mitra, a helpful AI agricultural assistant for Indian farmers. Reply in the language the farmer uses (English or Hindi).'
    );
    
    res.json({ success: true, reply, provider });
  } catch (error) {
    console.error('Chat Route Error:', error);
    // 503 = provider/quota problem (retryable), 500 = unexpected bug
    const status = error.code === 'PROVIDER_TIMEOUT' || /timed out|429|503/i.test(error.message) ? 503 : 500;
    res.status(status).json({
      success: false,
      error: status === 503
        ? 'AI service is busy right now — please try again in a few seconds.'
        : 'Failed to chat with AI',
    });
  }
});

module.exports = router;
