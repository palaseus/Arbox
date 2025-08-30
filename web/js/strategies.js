// Arbox Strategies Page - Strategy Management
class StrategiesManager {
    constructor() {
        this.provider = null;
        this.signer = null;
        this.strategies = {
            ai: { active: true, successRate: 85, totalTrades: 1247, avgProfit: 0.12, confidence: 92 },
            flashLoan: { active: true, successRate: 78, totalLoans: 892, avgProfit: 0.18, fee: 0.09 },
            crossChain: { active: false, successRate: 65, totalTrades: 156, avgProfit: 0.25, bridgeFee: 0.15 },
            dexIntegration: { active: false, successRate: 0, totalTrades: 0, avgProfit: 0, dexCount: 7 }
        };
        
        this.init();
    }
    
    async init() {
        this.setupEventListeners();
        this.loadStrategyData();
        this.startRealTimeUpdates();
    }
    
    setupEventListeners() {
        // Wallet connection
        document.getElementById('connect-wallet').addEventListener('click', () => {
            this.connectWallet();
        });
        
        // Global profit threshold slider
        const globalProfitThreshold = document.getElementById('global-profit-threshold');
        const globalProfitThresholdValue = document.getElementById('global-profit-threshold-value');
        globalProfitThreshold.addEventListener('input', (e) => {
            const value = e.target.value;
            globalProfitThresholdValue.textContent = value + '%';
            this.updateGlobalProfitThreshold(value);
        });
        
        // Strategy control buttons
        document.querySelectorAll('button').forEach(button => {
            if (button.textContent.includes('Start')) {
                button.addEventListener('click', (e) => {
                    const strategyCard = e.target.closest('.bg-gray-800');
                    const strategyName = this.getStrategyNameFromCard(strategyCard);
                    this.startStrategy(strategyName);
                });
            } else if (button.textContent.includes('Stop')) {
                button.addEventListener('click', (e) => {
                    const strategyCard = e.target.closest('.bg-gray-800');
                    const strategyName = this.getStrategyNameFromCard(strategyCard);
                    this.stopStrategy(strategyName);
                });
            } else if (button.textContent.includes('Details')) {
                button.addEventListener('click', (e) => {
                    const strategyCard = e.target.closest('.bg-gray-800');
                    const strategyName = this.getStrategyNameFromCard(strategyCard);
                    this.showStrategyDetails(strategyName);
                });
            }
        });
        
        // Configuration buttons
        document.querySelector('button').addEventListener('click', (e) => {
            if (e.target.textContent.includes('Save Configuration')) {
                this.saveConfiguration();
            } else if (e.target.textContent.includes('Reset to Defaults')) {
                this.resetConfiguration();
            }
        });
        
        // Settings inputs
        document.getElementById('global-max-gas').addEventListener('change', (e) => {
            this.updateGlobalMaxGas(e.target.value);
        });
        
        document.getElementById('global-max-exposure').addEventListener('change', (e) => {
            this.updateGlobalMaxExposure(e.target.value);
        });
    }
    
    getStrategyNameFromCard(card) {
        const title = card.querySelector('h3').textContent;
        if (title.includes('AI Arbitrage')) return 'ai';
        if (title.includes('Flash Loan')) return 'flashLoan';
        if (title.includes('Cross-Chain')) return 'crossChain';
        if (title.includes('DEX Integration')) return 'dexIntegration';
        return null;
    }
    
    async connectWallet() {
        try {
            if (typeof window.ethereum !== 'undefined') {
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
    
    loadStrategyData() {
        // Load strategy data from localStorage or API
        const savedStrategies = localStorage.getItem('arbox-strategies');
        if (savedStrategies) {
            this.strategies = { ...this.strategies, ...JSON.parse(savedStrategies) };
        }
        
        this.updateStrategyDisplay();
    }
    
    updateStrategyDisplay() {
        // Update AI Strategy
        this.updateStrategyCard('ai', this.strategies.ai);
        
        // Update Flash Loan Strategy
        this.updateStrategyCard('flashLoan', this.strategies.flashLoan);
        
        // Update Cross-Chain Strategy
        this.updateStrategyCard('crossChain', this.strategies.crossChain);
        
        // Update DEX Integration Strategy
        this.updateStrategyCard('dexIntegration', this.strategies.dexIntegration);
    }
    
    updateStrategyCard(strategyName, data) {
        const cards = document.querySelectorAll('.bg-gray-800');
        let targetCard = null;
        
        for (const card of cards) {
            const title = card.querySelector('h3').textContent;
            if (this.getStrategyNameFromCard(card) === strategyName) {
                targetCard = card;
                break;
            }
        }
        
        if (!targetCard) return;
        
        // Update status badge
        const statusBadge = targetCard.querySelector('.px-2.py-1');
        if (data.active) {
            statusBadge.className = 'px-2 py-1 bg-green-600 text-white text-xs rounded-full';
            statusBadge.textContent = 'Active';
        } else {
            statusBadge.className = 'px-2 py-1 bg-gray-600 text-white text-xs rounded-full';
            statusBadge.textContent = 'Inactive';
        }
        
        // Update metrics
        const metrics = targetCard.querySelectorAll('.flex.justify-between');
        metrics.forEach(metric => {
            const label = metric.querySelector('.text-gray-400').textContent;
            const value = metric.querySelector('.text-white, .text-green-500, .text-gray-400');
            
            if (label.includes('Success Rate:')) {
                value.textContent = data.successRate + '%';
            } else if (label.includes('Total Trades:') || label.includes('Total Loans:')) {
                value.textContent = data.totalTrades || data.totalLoans || '0';
            } else if (label.includes('Avg Profit:')) {
                if (data.avgProfit > 0) {
                    value.textContent = '+' + data.avgProfit + '%';
                    value.className = 'text-green-500 font-medium';
                } else {
                    value.textContent = '--';
                    value.className = 'text-gray-400';
                }
            } else if (label.includes('AI Confidence:')) {
                value.textContent = data.confidence + '%';
            } else if (label.includes('Loan Fee:') || label.includes('Bridge Fee:')) {
                value.textContent = data.fee + '%' || data.bridgeFee + '%';
            } else if (label.includes('DEX Count:')) {
                value.textContent = data.dexCount || '0';
            }
        });
        
        // Update card border
        targetCard.className = targetCard.className.replace(/strategy-\w+/g, '');
        if (data.active) {
            targetCard.classList.add('strategy-active');
        } else {
            targetCard.classList.add('strategy-inactive');
        }
    }
    
    startRealTimeUpdates() {
        // Update strategy metrics every 10 seconds
        setInterval(() => {
            this.updateStrategyMetrics();
        }, 10000);
    }
    
    updateStrategyMetrics() {
        // Simulate real-time updates
        Object.keys(this.strategies).forEach(strategyName => {
            const strategy = this.strategies[strategyName];
            if (strategy.active) {
                // Simulate small changes in metrics
                strategy.successRate = Math.max(50, Math.min(95, strategy.successRate + (Math.random() - 0.5) * 2));
                strategy.avgProfit = Math.max(0.05, Math.min(0.5, strategy.avgProfit + (Math.random() - 0.5) * 0.02));
                
                if (strategyName === 'ai') {
                    strategy.confidence = Math.max(80, Math.min(98, strategy.confidence + (Math.random() - 0.5) * 2));
                }
            }
        });
        
        this.updateStrategyDisplay();
    }
    
    async startStrategy(strategyName) {
        try {
            this.showNotification(`Starting ${strategyName} strategy...`, 'info');
            
            // Simulate strategy start
            setTimeout(() => {
                this.strategies[strategyName].active = true;
                this.updateStrategyDisplay();
                this.showNotification(`${strategyName} strategy started successfully!`, 'success');
                
                // Save to localStorage
                localStorage.setItem('arbox-strategies', JSON.stringify(this.strategies));
            }, 2000);
            
        } catch (error) {
            console.error('Error starting strategy:', error);
            this.showNotification(`Failed to start ${strategyName} strategy`, 'error');
        }
    }
    
    async stopStrategy(strategyName) {
        try {
            this.showNotification(`Stopping ${strategyName} strategy...`, 'info');
            
            // Simulate strategy stop
            setTimeout(() => {
                this.strategies[strategyName].active = false;
                this.updateStrategyDisplay();
                this.showNotification(`${strategyName} strategy stopped successfully!`, 'success');
                
                // Save to localStorage
                localStorage.setItem('arbox-strategies', JSON.stringify(this.strategies));
            }, 1000);
            
        } catch (error) {
            console.error('Error stopping strategy:', error);
            this.showNotification(`Failed to stop ${strategyName} strategy`, 'error');
        }
    }
    
    showStrategyDetails(strategyName) {
        const strategyNames = {
            ai: 'AI Arbitrage Strategy',
            flashLoan: 'Flash Loan Strategy',
            crossChain: 'Cross-Chain Strategy',
            dexIntegration: 'DEX Integration Strategy'
        };
        
        this.showNotification(`Opening detailed view for ${strategyNames[strategyName]}`, 'info');
        
        // Here you would open a modal or navigate to a detailed view
        // For now, just show a notification
    }
    
    async updateGlobalProfitThreshold(value) {
        try {
            console.log('Updating global profit threshold to:', value + '%');
            this.showNotification(`Global profit threshold updated to ${value}%`, 'success');
        } catch (error) {
            console.error('Error updating global profit threshold:', error);
            this.showNotification('Failed to update global profit threshold', 'error');
        }
    }
    
    async updateGlobalMaxGas(value) {
        try {
            console.log('Updating global max gas price to:', value + ' Gwei');
            this.showNotification(`Global max gas price updated to ${value} Gwei`, 'success');
        } catch (error) {
            console.error('Error updating global max gas price:', error);
            this.showNotification('Failed to update global max gas price', 'error');
        }
    }
    
    async updateGlobalMaxExposure(value) {
        try {
            console.log('Updating global max exposure to:', value + ' ETH');
            this.showNotification(`Global max exposure updated to ${value} ETH`, 'success');
        } catch (error) {
            console.error('Error updating global max exposure:', error);
            this.showNotification('Failed to update global max exposure', 'error');
        }
    }
    
    async saveConfiguration() {
        try {
            const config = {
                globalProfitThreshold: document.getElementById('global-profit-threshold').value,
                globalMaxGas: document.getElementById('global-max-gas').value,
                globalMaxExposure: document.getElementById('global-max-exposure').value,
                strategies: this.strategies
            };
            
            localStorage.setItem('arbox-config', JSON.stringify(config));
            this.showNotification('Configuration saved successfully!', 'success');
        } catch (error) {
            console.error('Error saving configuration:', error);
            this.showNotification('Failed to save configuration', 'error');
        }
    }
    
    async resetConfiguration() {
        try {
            // Reset to default values
            document.getElementById('global-profit-threshold').value = 0.5;
            document.getElementById('global-profit-threshold-value').textContent = '0.5%';
            document.getElementById('global-max-gas').value = 50;
            document.getElementById('global-max-exposure').value = 1000;
            
            // Reset strategies to default state
            this.strategies = {
                ai: { active: true, successRate: 85, totalTrades: 1247, avgProfit: 0.12, confidence: 92 },
                flashLoan: { active: true, successRate: 78, totalLoans: 892, avgProfit: 0.18, fee: 0.09 },
                crossChain: { active: false, successRate: 65, totalTrades: 156, avgProfit: 0.25, bridgeFee: 0.15 },
                dexIntegration: { active: false, successRate: 0, totalTrades: 0, avgProfit: 0, dexCount: 7 }
            };
            
            this.updateStrategyDisplay();
            this.showNotification('Configuration reset to defaults!', 'success');
        } catch (error) {
            console.error('Error resetting configuration:', error);
            this.showNotification('Failed to reset configuration', 'error');
        }
    }
    
    async loadContractData() {
        if (!this.signer) return;
        
        try {
            // Here you would load data from your smart contracts
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

// Initialize the strategies manager when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.strategiesManager = new StrategiesManager();
});

// Handle MetaMask account changes
if (typeof window.ethereum !== 'undefined') {
    window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length === 0) {
            document.getElementById('connect-wallet').textContent = 'Connect Wallet';
        } else {
            const address = accounts[0];
            document.getElementById('connect-wallet').textContent = 
                address.slice(0, 6) + '...' + address.slice(-4);
        }
    });
}

