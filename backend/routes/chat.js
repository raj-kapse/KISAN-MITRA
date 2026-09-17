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

    const { text: reply, provider } = await chatComplete(
      messages,
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
