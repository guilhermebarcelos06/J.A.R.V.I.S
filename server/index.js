import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from '@google/genai';
import ytsr from 'ytsr';
import mongoose from 'mongoose';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001; 

// Allow CORS - Explicit Configuration
app.use(cors({ 
    origin: '*', 
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));

app.use(express.json({ limit: '10mb' }));

// --- DATABASE CONFIGURATION ---
// CLEANUP: Remove accidental quotes or whitespace from the connection string
let MONGO_URI = process.env.MONGO_URI;
if (MONGO_URI) {
    MONGO_URI = MONGO_URI.trim().replace(/^["']|["']$/g, '');
}

const API_KEY = process.env.API_KEY || "AIzaSyCEbHiixjlWq6RVBbFUEQJQFv1_mUo8spc";
const ai = new GoogleGenAI({ apiKey: API_KEY });

// Connect to MongoDB
let isDbConnected = false;

if (MONGO_URI) {
    mongoose.connect(MONGO_URI)
        .then(() => {
            console.log('✅ Connected to MongoDB Cloud');
            isDbConnected = true;
        })
        .catch(err => {
            console.error('❌ MongoDB Connection Error:', err.message);
            isDbConnected = false;
            
            // Help debug by showing the masked URI (hides password)
            const maskedURI = MONGO_URI.replace(/:([^@]+)@/, ':****@');
            console.error(`Attempted to connect to: ${maskedURI}`);

            if ((MONGO_URI.match(/@/g) || []).length > 1) {
                console.error(`\n💡 HINT: Your connection string has multiple '@' symbols. If your password contains '@', you MUST replace it with '%40'.`);
            }
        });
} else {
    console.warn('⚠️ MONGO_URI not found. Running in ephemeral mode.');
}

// --- SCHEMAS ---
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true }, // In production, hash this!
    createdAt: { type: Date, default: Date.now }
});

const chatSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    messages: [{
        id: String,
        role: String,
        text: String,
        image: String,
        timestamp: Number
    }],
    updatedAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Chat = mongoose.model('Chat', chatSchema);

// --- ROUTES ---

app.get('/', (req, res) => res.send('Jarvis Backend Online'));

app.get('/api/config', (req, res) => {
  res.json({ apiKey: API_KEY });
});

// AUTH: Register
app.post('/api/register', async (req, res) => {
    // Check if DB is actually connected
    if (!MONGO_URI || !isDbConnected || mongoose.connection.readyState !== 1) {
        return res.status(503).json({ error: 'Database disconnected. Use admin/jarvis to login.' });
    }
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ error: 'Missing credentials' });
        
        const existing = await User.findOne({ username });
        if (existing) return res.status(409).json({ error: 'Username already exists' });

        const newUser = new User({ username, password });
        await newUser.save();
        
        res.json({ success: true, userId: newUser._id, username: newUser.username });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// AUTH: Login
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        // Fallback to Local Mode if DB is down or not configured
        // This ensures you can always log in as Admin even if Mongo fails
        if (!MONGO_URI || !isDbConnected || mongoose.connection.readyState !== 1) {
            console.warn('⚠️ Login attempted in Offline/Emergency Mode');
            if (username.toLowerCase() === 'admin' && password.toLowerCase() === 'jarvis') {
                return res.json({ success: true, userId: 'local-admin', username: 'Admin' });
            }
            return res.status(401).json({ error: 'DB Error. Use admin/jarvis to login.' });
        }

        const user = await User.findOne({ username, password });
        if (user) {
            res.json({ success: true, userId: user._id, username: user.username });
        } else {
            res.status(401).json({ error: 'Invalid credentials' });
        }
    } catch (error) {
        // Final safety net for login
        if (req.body.username?.toLowerCase() === 'admin' && req.body.password?.toLowerCase() === 'jarvis') {
             return res.json({ success: true, userId: 'local-admin', username: 'Admin' });
        }
        res.status(500).json({ error: error.message });
    }
});

// CHAT: Get History
app.get('/api/chat/:userId', async (req, res) => {
    if (!MONGO_URI || !isDbConnected) return res.json({ messages: [] });
    try {
        const chat = await Chat.findOne({ userId: req.params.userId });
        res.json({ messages: chat ? chat.messages : [] });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// CHAT: Save History
app.post('/api/chat', async (req, res) => {
    if (!MONGO_URI || !isDbConnected) return res.json({ success: true }); // Mock success
    try {
        const { userId, messages } = req.body;
        // Don't save for local admin
        if (userId === 'local-admin') return res.json({ success: true });

        await Chat.findOneAndUpdate(
            { userId },
            { messages, updatedAt: Date.now() },
            { upsert: true, new: true }
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// YOUTUBE
app.post('/api/youtube-search', async (req, res) => {
    try {
        const { query } = req.body;
        if (!query) return res.status(400).json({ error: 'Query required' });
        console.log(`Searching YouTube for: ${query}`);
        const filters1 = await ytsr.getFilters(query);
        const filter1 = filters1.get('Type').get('Video');
        
        if (!filter1.url) {
             const searchResults = await ytsr(query, { limit: 1 });
             if (searchResults.items && searchResults.items.length > 0) {
                 return res.json({ success: true, videoId: searchResults.items[0].id, title: searchResults.items[0].title });
             }
             return res.status(404).json({ success: false, error: 'No videos found' });
        }
        const searchResults = await ytsr(filter1.url, { limit: 1 });
        if (searchResults.items && searchResults.items.length > 0) {
            const video = searchResults.items[0];
            return res.json({ success: true, videoId: video.id, title: video.title });
        } else {
            return res.status(404).json({ success: false, error: 'No videos found' });
        }
    } catch (error) {
        console.error('YouTube Search Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// IMAGE GENERATION
app.post('/api/generate-image', async (req, res) => {
    try {
        const { prompt } = req.body;
        if (!prompt) return res.status(400).json({ error: 'Prompt required' });
        console.log(`Generating image for: ${prompt}`);
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: [{ parts: [{ text: prompt }] }],
            config: {
                imageConfig: { aspectRatio: "1:1" },
                safetySettings: [
                    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE }
                ]
            }
        });
        const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
        if (part && part.inlineData) {
            const imageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            return res.json({ success: true, imageUrl });
        } else {
            return res.status(500).json({ success: false, error: 'No image data returned' });
        }
    } catch (error) {
        console.error('Image Gen Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(PORT, () => {
  console.log(`\n🚀 Jarvis Backend running at port ${PORT}`);
});