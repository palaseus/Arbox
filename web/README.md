# Arbox Web Interface

A modern, responsive web interface for the Arbox Advanced DeFi Arbitrage Engine.

## 🚀 Features

- **Real-time Dashboard**: Live monitoring of arbitrage activities and profits
- **Strategy Management**: Start, stop, and configure different arbitrage strategies
- **Interactive Charts**: Visual representation of profit history and performance
- **Wallet Integration**: Connect with MetaMask and other Web3 wallets
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **Real-time Updates**: Live activity feed and metrics updates

## 📋 Prerequisites

- Node.js 16.0.0 or higher
- npm or yarn package manager
- Modern web browser with Web3 wallet support (MetaMask recommended)

## 🛠️ Installation

1. **Navigate to the web directory:**
   ```bash
   cd web
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. **Open your browser and navigate to:**
   ```
   http://localhost:3000
   ```

## 📱 Pages

### Dashboard (`/`)
- Real-time activity feed
- Profit history chart
- Quick controls for engine management
- Status overview cards
- Network status monitoring

### Strategies (`/strategies`)
- Individual strategy management
- Performance metrics for each strategy
- Start/stop controls
- Configuration settings
- Strategy status indicators

### Analytics (`/analytics`) - Coming Soon
- Detailed performance analytics
- Historical data analysis
- Risk assessment metrics
- Profit optimization insights

### Settings (`/settings`) - Coming Soon
- System configuration
- Network settings
- Security preferences
- User preferences

## 🔧 Configuration

### Environment Variables
- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment mode (development/production)

### Local Storage
The interface uses browser localStorage to persist:
- Strategy configurations
- User preferences
- Session data

## 🎨 Customization

### Styling
The interface uses Tailwind CSS for styling. You can customize:
- Colors and themes in the CSS variables
- Layout and spacing
- Component styling

### JavaScript
The interface is built with vanilla JavaScript and includes:
- Web3 integration with ethers.js
- Real-time updates and notifications
- Chart.js for data visualization
- Local storage management

## 🔌 API Integration

The web interface includes API endpoints for future integration with the arbitrage engine:

- `GET /api/status` - System status
- `GET /api/strategies` - Strategy data
- `GET /api/metrics` - Performance metrics

## 🚀 Deployment

### Production Build
```bash
npm start
```

### Docker Deployment
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

### Environment Variables
```bash
PORT=3000
NODE_ENV=production
```

## 🔒 Security

- HTTPS recommended for production
- Web3 wallet integration for secure transactions
- Input validation and sanitization
- CORS configuration for API endpoints

## 🐛 Troubleshooting

### Common Issues

1. **Port already in use:**
   ```bash
   # Change port
   PORT=3001 npm start
   ```

2. **Web3 wallet not connecting:**
   - Ensure MetaMask is installed and unlocked
   - Check browser console for errors
   - Verify network connection

3. **Charts not loading:**
   - Check internet connection for CDN resources
   - Verify Chart.js is loaded correctly

### Debug Mode
```bash
NODE_ENV=development npm run dev
```

## 📈 Performance

- Optimized for real-time updates
- Efficient DOM manipulation
- Minimal external dependencies
- Responsive design for all devices

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

For support and questions:
- Check the troubleshooting section
- Review the browser console for errors
- Ensure all dependencies are installed correctly

---

**Version**: 3.4.0  
**Last Updated**: January 2025

