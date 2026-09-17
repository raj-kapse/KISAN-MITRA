const express = require('express');
const router = express.Router();
const { chatComplete } = require('../services/textProvider');
const { aiRateLimit } = require('../middleware/rateLimit');

/**
 * POST /api/chat
 * Body: { messages: [{role, content}], context: string }
 */
router.post('/chat', aiRateLimit, async (req, res) => {
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
    res.status(500).json({ success: false, error: 'Failed to chat with AI' });
  }
});

module.exports = router;
