const express = require('express');
const router = express.Router();
const { chatWithGemini } = require('../services/gemini');

/**
 * POST /api/chat
 * Body: { messages: [{role, content}], context: string }
 */
router.post('/chat', async (req, res) => {
  try {
    const { messages, context } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ success: false, error: 'Invalid messages format' });
    }

    const reply = await chatWithGemini(messages, context || 'You are Kisan Mitra, an AI crop advisor.');
    
    res.json({ success: true, reply });
  } catch (error) {
    console.error('Chat Route Error:', error);
    res.status(500).json({ success: false, error: 'Failed to chat with AI' });
  }
});

module.exports = router;
