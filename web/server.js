const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static(path.join(__dirname)));

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Serve other pages
app.get('/strategies', (req, res) => {
    res.sendFile(path.join(__dirname, 'strategies.html'));
});

app.get('/analytics', (req, res) => {
    res.sendFile(path.join(__dirname, 'analytics.html'));
});

app.get('/settings', (req, res) => {
    res.sendFile(path.join(__dirname, 'settings.html'));
});

// API endpoints for future integration
app.get('/api/status', (req, res) => {
    res.json({
        status: 'running',
        timestamp: new Date().toISOString(),
        version: '3.4.0'
    });
});

app.get('/api/strategies', (req, res) => {
    res.json({
        ai: { active: true, successRate: 85, totalTrades: 1247, avgProfit: 0.12, confidence: 92 },
        flashLoan: { active: true, successRate: 78, totalLoans: 892, avgProfit: 0.18, fee: 0.09 },
        crossChain: { active: false, successRate: 65, totalTrades: 156, avgProfit: 0.25, bridgeFee: 0.15 },
        dexIntegration: { active: false, successRate: 0, totalTrades: 0, avgProfit: 0, dexCount: 7 }
    });
});

app.get('/api/metrics', (req, res) => {
    res.json({
        totalProfit: '+2.8 ETH',
        successRate: '80%',
        activeStrategies: 3,
        mevProtection: 'Active',
        lastUpdate: new Date().toISOString()
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Arbox Web Interface running on http://localhost:${PORT}`);
    console.log(`📊 Dashboard: http://localhost:${PORT}`);
    console.log(`⚙️  Strategies: http://localhost:${PORT}/strategies`);
    console.log(`📈 Analytics: http://localhost:${PORT}/analytics`);
    console.log(`🔧 Settings: http://localhost:${PORT}/settings`);
});

