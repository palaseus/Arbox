# 🤖 DeepSeek AI Setup Guide

## 🔐 Security Configuration

### 1. Environment Variables Setup

Create a `.env` file in the project root with the following variables:

```bash
# =============================================================================
# AI CONFIGURATION
# =============================================================================
DEEPSEEK_API_KEY=your_deepseek_api_key_here
DEEPSEEK_API_URL=https://api.deepseek.com/v1
AI_MODEL=deepseek-chat
AI_MAX_TOKENS=4000
AI_TEMPERATURE=0.7

# =============================================================================
# NETWORK CONFIGURATION
# =============================================================================
LOCALHOST_RPC_URL=http://127.0.0.1:8545
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/your_infura_project_id
MAINNET_RPC_URL=https://mainnet.infura.io/v3/your_infura_project_id
ETHERSCAN_API_KEY=your_etherscan_api_key

# =============================================================================
# DEPLOYMENT CONFIGURATION
# =============================================================================
PRIVATE_KEY=your_private_key_here
ADMIN_ADDRESS=your_admin_address_here
```

### 2. Getting Your DeepSeek API Key

1. Visit [DeepSeek AI](https://platform.deepseek.com/)
2. Create an account or sign in
3. Navigate to API Keys section
4. Generate a new API key
5. Copy the key and add it to your `.env` file

### 3. Security Best Practices

⚠️ **IMPORTANT SECURITY NOTES:**

- **NEVER commit your `.env` file to version control**
- **NEVER share your API keys publicly**
- **Use different API keys for development and production**
- **Regularly rotate your API keys**
- **Monitor API usage to avoid rate limits**

## 🚀 Testing the AI Integration

### 1. Test with API Key

```bash
# Make sure your .env file is configured
npx ts-node scripts/test-deepseek-ai.ts
```

### 2. Test without API Key (Fallback Mode)

If no API key is configured, the system will use fallback analysis:

```bash
# Remove DEEPSEEK_API_KEY from .env to test fallback
npx ts-node scripts/test-deepseek-ai.ts
```

## 🔧 Configuration Options

### AI Model Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `AI_MODEL` | `deepseek-chat` | DeepSeek model to use |
| `AI_MAX_TOKENS` | `4000` | Maximum tokens for AI responses |
| `AI_TEMPERATURE` | `0.7` | AI creativity level (0.0-1.0) |

### Advanced Configuration

```bash
# For more conservative AI decisions
AI_TEMPERATURE=0.3

# For more creative AI decisions
AI_TEMPERATURE=0.9

# For longer AI responses
AI_MAX_TOKENS=8000
```

## 🎯 AI Features

### 1. Arbitrage Opportunity Analysis
- Profit probability calculation
- Risk assessment
- Optimal amount calculation
- Gas cost analysis

### 2. Market Insights
- Price trend analysis
- Volatility assessment
- Liquidity analysis
- Market sentiment evaluation

### 3. Strategy Optimization
- Performance-based parameter adjustment
- Learning rate optimization
- Risk tolerance calibration
- Gas optimization strategies

## 🛡️ Fallback Mode

When the DeepSeek API is unavailable or not configured:

- System uses conservative fallback analysis
- Risk scores are set to high (70%)
- Confidence levels are set to low (30%)
- Recommendations focus on safety

## 📊 Monitoring

### API Usage Monitoring

Monitor your DeepSeek API usage:
- Check API dashboard for usage statistics
- Set up alerts for rate limit approaching
- Monitor response times and success rates

### Performance Metrics

Track AI performance:
- Success rate of AI recommendations
- Profit accuracy of AI predictions
- Risk assessment accuracy
- Gas cost prediction accuracy

## 🔄 Troubleshooting

### Common Issues

1. **API Key Not Found**
   - Ensure `.env` file exists and is properly formatted
   - Check that `DEEPSEEK_API_KEY` is set correctly
   - Verify no extra spaces or quotes around the key

2. **API Rate Limits**
   - Reduce request frequency
   - Implement request caching
   - Consider upgrading API plan

3. **Network Issues**
   - Check internet connectivity
   - Verify API endpoint accessibility
   - Check firewall settings

### Debug Mode

Enable debug logging:

```bash
# Add to .env
DEBUG=true
```

## 📈 Performance Optimization

### 1. Caching
- AI analysis results are cached for 5 minutes
- Market data is cached to reduce API calls
- Historical performance data is stored locally

### 2. Batch Processing
- Multiple opportunities can be analyzed in batches
- Reduces API call frequency
- Improves overall system efficiency

### 3. Smart Fallbacks
- Graceful degradation when AI is unavailable
- Conservative decision making in fallback mode
- Continuous monitoring for AI service restoration

## 🎉 Ready to Use!

Your AI-powered arbitrage engine is now configured and ready to generate profits with advanced AI decision making!

For more information, see the main [README.md](README.md) and [CHANGELOG.md](CHANGELOG.md).
