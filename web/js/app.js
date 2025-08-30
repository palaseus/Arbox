// Arbox Web Interface - Main Application
class ArboxApp {
    constructor() {
        this.provider = null;
        this.signer = null;
        this.contracts = {};
        this.isRunning = false;
        this.activityFeed = [];
        this.profitHistory = [];
        
        this.init();
    }
    
    async init() {
        this.setupEventListeners();
        this.initializeCharts();
        this.startRealTimeUpdates();
        this.loadMockData();
    }
    
    setupEventListeners() {
        // Wallet connection
        document.getElementById('connect-wallet').addEventListener('click', () => {
            this.connectWallet();
        });
        
        // Profit threshold slider
        const profitThreshold = document.getElementById('profit-threshold');
        const profitThresholdValue = document.getElementById('profit-threshold-value');
        profitThreshold.addEventListener('input', (e) => {
            const value = e.target.value;
            profitThresholdValue.textContent = value + '%';
            this.updateProfitThreshold(value);
        });
        
        // Control buttons
        document.querySelectorAll('button').forEach(button => {
            if (button.textContent.includes('Start')) {
                button.addEventListener('click', () => this.startArbitrage());
            } else if (button.textContent.includes('Stop')) {
                button.addEventListener('click', () => this.stopArbitrage());
            }
        });
        
        // Settings inputs
        document.getElementById('max-gas-price').addEventListener('change', (e) => {
            this.updateMaxGasPrice(e.target.value);
        });
        
        document.getElementById('max-exposure').addEventListener('change', (e) => {
            this.updateMaxExposure(e.target.value);
        });
    }
    
    async connectWallet() {
        try {
            if (typeof window.ethereum !== 'undefined') {
                // Request account access
                const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
                this.provider = new ethers.providers.Web3Provider(window.ethereum);
                this.signer = this.provider.getSigner();
                
                const address = await this.signer.getAddress();
                document.getElementById('connect-wallet').textContent = 
                    address.slice(0, 6) + '...' + address.slice(-4);
                
                this.showNotification('Wallet connected successfully!', 'success');
                this.loadContractData();
            } else {
                this.showNotification('Please install MetaMask or another Web3 wallet', 'error');
            }
        } catch (error) {
            console.error('Error connecting wallet:', error);
            this.showNotification('Failed to connect wallet', 'error');
        }
    }
    
    initializeCharts() {
        const ctx = document.getElementById('profitChart').getContext('2d');
        this.profitChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Profit (ETH)',
                    data: [],
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: '#ffffff'
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: {
                            color: '#9ca3af'
                        },
                        grid: {
                            color: '#374151'
                        }
                    },
                    y: {
                        ticks: {
                            color: '#9ca3af'
                        },
                        grid: {
                            color: '#374151'
                        }
                    }
                }
            }
        });
    }
    
    startRealTimeUpdates() {
        // Update activity feed every 3 seconds
        setInterval(() => {
            this.updateActivityFeed();
        }, 3000);
        
        // Update profit chart every 10 seconds
        setInterval(() => {
            this.updateProfitChart();
        }, 10000);
        
        // Update status metrics every 5 seconds
        setInterval(() => {
            this.updateStatusMetrics();
        }, 5000);
    }
    
    loadMockData() {
        // Load mock profit history
        const now = new Date();
        for (let i = 24; i >= 0; i--) {
            const time = new Date(now.getTime() - i * 3600000);
            const profit = Math.random() * 0.5 - 0.1; // Random profit between -0.1 and 0.4 ETH
            this.profitHistory.push({
                time: time.toLocaleTimeString(),
                profit: profit
            });
        }
        this.updateProfitChart();
        
        // Load mock activity feed
        this.activityFeed = [
            {
                type: 'opportunity',
                message: 'Arbitrage opportunity found: ETH/USDC on Uniswap V3',
                details: 'Expected profit: 0.15% | Gas: 0.002 ETH',
                time: '2s ago',
                status: 'success'
            },
            {
                type: 'flash_loan',
                message: 'Flash loan executed: 1000 ETH from Aave V3',
                details: 'Amount: 1000 ETH | Fee: 0.09%',
                time: '5s ago',
                status: 'info'
            },
            {
                type: 'swap',
                message: 'Swap completed: ETH → USDC on SushiSwap',
                details: 'Amount: 10 ETH | Received: 18,500 USDC',
                time: '8s ago',
                status: 'success'
            },
            {
                type: 'mev_protection',
                message: 'MEV protection activated: Sandwich attack detected',
                details: 'Transaction delayed by 2 blocks',
                time: '12s ago',
                status: 'warning'
            }
        ];
        this.updateActivityFeed();
    }
    
    updateActivityFeed() {
        const feedContainer = document.querySelector('.space-y-4.max-h-96');
        if (!feedContainer) return;
        
        // Add new activity (mock)
        if (Math.random() > 0.7) {
            const activities = [
                {
                    type: 'opportunity',
                    message: 'Arbitrage opportunity found: ETH/USDT on Balancer V2',
                    details: 'Expected profit: 0.12% | Gas: 0.0018 ETH',
                    status: 'success'
                },
                {
                    type: 'swap',
                    message: 'Swap completed: USDC → ETH on Curve Finance',
                    details: 'Amount: 5000 USDC | Received: 2.7 ETH',
                    status: 'success'
                },
                {
                    type: 'mev_protection',
                    message: 'MEV protection: Front-running attempt blocked',
                    details: 'Transaction reordered successfully',
                    status: 'warning'
                },
                {
                    type: 'error',
                    message: 'Transaction failed: Insufficient liquidity',
                    details: 'Retrying with different route',
                    status: 'error'
                }
            ];
            
            const newActivity = activities[Math.floor(Math.random() * activities.length)];
            this.addActivityToFeed(newActivity);
        }
    }
    
    addActivityToFeed(activity) {
        const feedContainer = document.querySelector('.space-y-4.max-h-96');
        const activityDiv = document.createElement('div');
        activityDiv.className = 'flex items-center space-x-4 p-4 bg-gray-700 rounded-lg';
        
        const statusColors = {
            success: 'bg-green-500',
            info: 'bg-blue-500',
            warning: 'bg-yellow-500',
            error: 'bg-red-500'
        };
        
        activityDiv.innerHTML = `
            <div class="w-2 h-2 ${statusColors[activity.status]} rounded-full"></div>
            <div class="flex-1">
                <p class="text-sm text-white">${activity.message}</p>
                <p class="text-xs text-gray-400">${activity.details}</p>
            </div>
            <span class="text-xs text-gray-400">now</span>
        `;
        
        feedContainer.insertBefore(activityDiv, feedContainer.firstChild);
        
        // Remove old activities if too many
        const activities = feedContainer.children;
        if (activities.length > 20) {
            feedContainer.removeChild(activities[activities.length - 1]);
        }
    }
    
    updateProfitChart() {
        if (!this.profitChart) return;
        
        // Add new data point
        const now = new Date();
        const profit = Math.random() * 0.5 - 0.1;
        this.profitHistory.push({
            time: now.toLocaleTimeString(),
            profit: profit
        });
        
        // Keep only last 25 data points
        if (this.profitHistory.length > 25) {
            this.profitHistory.shift();
        }
        
        // Update chart
        this.profitChart.data.labels = this.profitHistory.map(d => d.time);
        this.profitChart.data.datasets[0].data = this.profitHistory.map(d => d.profit);
        this.profitChart.update('none');
        
        // Update total profit
        const totalProfit = this.profitHistory.reduce((sum, d) => sum + d.profit, 0);
        document.getElementById('total-profit').textContent = 
            (totalProfit >= 0 ? '+' : '') + totalProfit.toFixed(2) + ' ETH';
    }
    
    updateStatusMetrics() {
        // Update success rate
        const successRate = 75 + Math.random() * 20; // 75-95%
        document.getElementById('success-rate').textContent = Math.round(successRate) + '%';
        
        // Update active strategies
        const activeStrategies = 2 + Math.floor(Math.random() * 2); // 2-3
        document.getElementById('active-strategies').textContent = activeStrategies;
    }
    
    async startArbitrage() {
        if (this.isRunning) {
            this.showNotification('Arbitrage engine is already running', 'warning');
            return;
        }
        
        try {
            this.isRunning = true;
            this.showNotification('Starting arbitrage engine...', 'info');
            
            // Simulate starting the engine
            setTimeout(() => {
                this.showNotification('Arbitrage engine started successfully!', 'success');
                this.addActivityToFeed({
                    type: 'system',
                    message: 'Arbitrage engine started',
                    details: 'All strategies activated and monitoring',
                    status: 'success'
                });
            }, 2000);
            
        } catch (error) {
            console.error('Error starting arbitrage:', error);
            this.showNotification('Failed to start arbitrage engine', 'error');
            this.isRunning = false;
        }
    }
    
    async stopArbitrage() {
        if (!this.isRunning) {
            this.showNotification('Arbitrage engine is not running', 'warning');
            return;
        }
        
        try {
            this.isRunning = false;
            this.showNotification('Stopping arbitrage engine...', 'info');
            
            // Simulate stopping the engine
            setTimeout(() => {
                this.showNotification('Arbitrage engine stopped successfully!', 'success');
                this.addActivityToFeed({
                    type: 'system',
                    message: 'Arbitrage engine stopped',
                    details: 'All strategies deactivated',
                    status: 'warning'
                });
            }, 1000);
            
        } catch (error) {
            console.error('Error stopping arbitrage:', error);
            this.showNotification('Failed to stop arbitrage engine', 'error');
            this.isRunning = true;
        }
    }
    
    async updateProfitThreshold(value) {
        try {
            // Here you would call the smart contract to update the profit threshold
            console.log('Updating profit threshold to:', value + '%');
            this.showNotification(`Profit threshold updated to ${value}%`, 'success');
        } catch (error) {
            console.error('Error updating profit threshold:', error);
            this.showNotification('Failed to update profit threshold', 'error');
        }
    }
    
    async updateMaxGasPrice(value) {
        try {
            console.log('Updating max gas price to:', value + ' Gwei');
            this.showNotification(`Max gas price updated to ${value} Gwei`, 'success');
        } catch (error) {
            console.error('Error updating max gas price:', error);
            this.showNotification('Failed to update max gas price', 'error');
        }
    }
    
    async updateMaxExposure(value) {
        try {
            console.log('Updating max exposure to:', value + ' ETH');
            this.showNotification(`Max exposure updated to ${value} ETH`, 'success');
        } catch (error) {
            console.error('Error updating max exposure:', error);
            this.showNotification('Failed to update max exposure', 'error');
        }
    }
    
    async loadContractData() {
        if (!this.signer) return;
        
        try {
            // Here you would load data from your smart contracts
            // For now, we'll just show a success message
            this.showNotification('Contract data loaded successfully', 'success');
        } catch (error) {
            console.error('Error loading contract data:', error);
            this.showNotification('Failed to load contract data', 'error');
        }
    }
    
    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 max-w-sm ${
            type === 'success' ? 'bg-green-600' :
            type === 'error' ? 'bg-red-600' :
            type === 'warning' ? 'bg-yellow-600' : 'bg-blue-600'
        }`;
        
        notification.innerHTML = `
            <div class="flex items-center">
                <div class="flex-shrink-0">
                    <i class="fas ${
                        type === 'success' ? 'fa-check' :
                        type === 'error' ? 'fa-exclamation-triangle' :
                        type === 'warning' ? 'fa-exclamation-circle' : 'fa-info-circle'
                    } text-white"></i>
                </div>
                <div class="ml-3">
                    <p class="text-sm font-medium text-white">${message}</p>
                </div>
                <div class="ml-auto pl-3">
                    <button class="text-white hover:text-gray-200" onclick="this.parentElement.parentElement.parentElement.remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }
}

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.arboxApp = new ArboxApp();
});

// Handle MetaMask account changes
if (typeof window.ethereum !== 'undefined') {
    window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length === 0) {
            // MetaMask is locked or the user has no accounts
            document.getElementById('connect-wallet').textContent = 'Connect Wallet';
        } else {
            // Handle the new accounts
            const address = accounts[0];
            document.getElementById('connect-wallet').textContent = 
                address.slice(0, 6) + '...' + address.slice(-4);
        }
    });
}

