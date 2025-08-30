#!/usr/bin/env ts-node

import { ethers } from "hardhat";
import { config as dotenvConfig } from "dotenv";
import chalk from "chalk";
import fs from "fs";
import path from "path";

dotenvConfig();

interface SecurityIssue {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  description: string;
  recommendation: string;
  line?: number;
  contract?: string;
  function?: string;
}

interface SecurityReport {
  contract: string;
  issues: SecurityIssue[];
  score: number;
  riskLevel: 'safe' | 'low' | 'medium' | 'high' | 'critical';
}

class SecurityScanner {
  private issues: SecurityIssue[] = [];
  private reports: SecurityReport[] = [];

  constructor() {
    this.initializeSecurityRules();
  }

  private initializeSecurityRules() {
    // Define security rules and patterns to check for
    this.issues = [
      // Reentrancy vulnerabilities
      {
        id: "REENTRANCY-001",
        severity: "critical",
        title: "Potential Reentrancy Attack",
        description: "External calls before state changes can lead to reentrancy attacks",
        recommendation: "Use ReentrancyGuard or follow checks-effects-interactions pattern"
      },
      {
        id: "REENTRANCY-002",
        severity: "high",
        title: "Unsafe External Calls",
        description: "External calls without proper protection",
        recommendation: "Implement proper access controls and validation"
      },

      // Access control issues
      {
        id: "ACCESS-001",
        severity: "critical",
        title: "Missing Access Control",
        description: "Critical functions lack proper access control",
        recommendation: "Add onlyOwner or role-based access control"
      },
      {
        id: "ACCESS-002",
        severity: "high",
        title: "Insufficient Access Control",
        description: "Access control may be bypassed",
        recommendation: "Implement multi-signature or time-lock mechanisms"
      },

      // Integer overflow/underflow
      {
        id: "MATH-001",
        severity: "medium",
        title: "Potential Integer Overflow",
        description: "Arithmetic operations may overflow",
        recommendation: "Use SafeMath or Solidity 0.8+ built-in checks"
      },

      // Gas optimization issues
      {
        id: "GAS-001",
        severity: "low",
        title: "Inefficient Gas Usage",
        description: "Unoptimized storage or loop operations",
        recommendation: "Optimize storage layout and loop operations"
      },

      // MEV protection issues
      {
        id: "MEV-001",
        severity: "high",
        title: "MEV Vulnerability",
        description: "Transactions may be front-run or sandwiched",
        recommendation: "Implement Flashbots or private mempool solutions"
      },

      // Price manipulation
      {
        id: "PRICE-001",
        severity: "critical",
        title: "Price Manipulation Risk",
        description: "Oracle prices may be manipulated",
        recommendation: "Use multiple oracle sources and implement deviation checks"
      },

      // Flash loan attacks
      {
        id: "FLASH-001",
        severity: "high",
        title: "Flash Loan Attack Vector",
        description: "Contract may be vulnerable to flash loan attacks",
        recommendation: "Implement proper validation and checks"
      }
    ];
  }

  async scanContract(contractName: string): Promise<SecurityReport> {
    console.log(chalk.blue(`🔍 Scanning ${contractName} for security issues...`));

    const contractPath = path.join(__dirname, "..", "contracts", `${contractName}.sol`);
    let sourceCode = "";

    try {
      sourceCode = fs.readFileSync(contractPath, 'utf8');
    } catch (error) {
      console.log(chalk.yellow(`⚠️  Contract file not found: ${contractPath}`));
      return this.createEmptyReport(contractName);
    }

    const issues: SecurityIssue[] = [];
    
    // Check for reentrancy vulnerabilities
    issues.push(...this.checkReentrancyVulnerabilities(sourceCode, contractName));
    
    // Check for access control issues
    issues.push(...this.checkAccessControlIssues(sourceCode, contractName));
    
    // Check for math vulnerabilities
    issues.push(...this.checkMathVulnerabilities(sourceCode, contractName));
    
    // Check for gas optimization issues
    issues.push(...this.checkGasOptimizationIssues(sourceCode, contractName));
    
    // Check for MEV vulnerabilities
    issues.push(...this.checkMEVVulnerabilities(sourceCode, contractName));
    
    // Check for price manipulation risks
    issues.push(...this.checkPriceManipulationRisks(sourceCode, contractName));
    
    // Check for flash loan vulnerabilities
    issues.push(...this.checkFlashLoanVulnerabilities(sourceCode, contractName));

    const score = this.calculateSecurityScore(issues);
    const riskLevel = this.determineRiskLevel(score);

    const report: SecurityReport = {
      contract: contractName,
      issues,
      score,
      riskLevel
    };

    this.reports.push(report);
    return report;
  }

  private checkReentrancyVulnerabilities(sourceCode: string, contractName: string): SecurityIssue[] {
    const issues: SecurityIssue[] = [];
    
    // Check for external calls before state changes
    const externalCallPatterns = [
      /\.call\(/g,
      /\.transfer\(/g,
      /\.send\(/g,
      /\.delegatecall\(/g
    ];

    const stateChangePatterns = [
      /\.balance\s*=/g,
      /mapping\s*\[.*\]\s*.*\s*=/g,
      /uint256\s+.*\s*=/g
    ];

    const lines = sourceCode.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check if line contains external call
      const hasExternalCall = externalCallPatterns.some(pattern => pattern.test(line));
      
      if (hasExternalCall) {
        // Check if there are state changes after this line
        for (let j = i + 1; j < lines.length; j++) {
          const nextLine = lines[j];
          const hasStateChange = stateChangePatterns.some(pattern => pattern.test(nextLine));
          
          if (hasStateChange) {
            issues.push({
              ...this.issues.find(issue => issue.id === "REENTRANCY-001")!,
              line: i + 1,
              contract: contractName
            });
            break;
          }
        }
      }
    }

    return issues;
  }

  private checkAccessControlIssues(sourceCode: string, contractName: string): SecurityIssue[] {
    const issues: SecurityIssue[] = [];
    
    // Check for critical functions without access control
    const criticalFunctions = [
      'withdraw',
      'emergencyStop',
      'pause',
      'unpause',
      'transferOwnership',
      'setAdmin',
      'upgrade'
    ];

    const accessControlPatterns = [
      /onlyOwner/g,
      /onlyAdmin/g,
      /onlyRole/g,
      /require\(msg\.sender\s*==\s*owner/g
    ];

    const lines = sourceCode.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check if line contains critical function
      const hasCriticalFunction = criticalFunctions.some(func => 
        line.includes(`function ${func}`) || line.includes(`function ${func}(`)
      );
      
      if (hasCriticalFunction) {
        // Check if function has access control
        const hasAccessControl = accessControlPatterns.some(pattern => pattern.test(line));
        
        if (!hasAccessControl) {
          // Check next few lines for access control
          let foundAccessControl = false;
          for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
            const nextLine = lines[j];
            if (accessControlPatterns.some(pattern => pattern.test(nextLine))) {
              foundAccessControl = true;
              break;
            }
          }
          
          if (!foundAccessControl) {
            issues.push({
              ...this.issues.find(issue => issue.id === "ACCESS-001")!,
              line: i + 1,
              contract: contractName,
              function: criticalFunctions.find(func => line.includes(func))
            });
          }
        }
      }
    }

    return issues;
  }

  private checkMathVulnerabilities(sourceCode: string, contractName: string): SecurityIssue[] {
    const issues: SecurityIssue[] = [];
    
    // Check for unsafe arithmetic operations
    const unsafeMathPatterns = [
      /\+/g,
      /-/g,
      /\*/g,
      /\//g
    ];

    const safeMathPatterns = [
      /SafeMath/g,
      /\.add\(/g,
      /\.sub\(/g,
      /\.mul\(/g,
      /\.div\(/g
    ];

    const lines = sourceCode.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check if line contains arithmetic operations
      const hasArithmetic = unsafeMathPatterns.some(pattern => pattern.test(line));
      
      if (hasArithmetic) {
        // Check if SafeMath is used
        const hasSafeMath = safeMathPatterns.some(pattern => pattern.test(line));
        
        if (!hasSafeMath) {
          issues.push({
            ...this.issues.find(issue => issue.id === "MATH-001")!,
            line: i + 1,
            contract: contractName
          });
        }
      }
    }

    return issues;
  }

  private checkGasOptimizationIssues(sourceCode: string, contractName: string): SecurityIssue[] {
    const issues: SecurityIssue[] = [];
    
    // Check for inefficient storage patterns
    const inefficientPatterns = [
      /for\s*\(.*\s*;\s*.*\s*;\s*.*\+\+\)/g,
      /while\s*\(.*\)/g,
      /storage\s+.*\s*\[\]/g
    ];

    const lines = sourceCode.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      const hasInefficientPattern = inefficientPatterns.some(pattern => pattern.test(line));
      
      if (hasInefficientPattern) {
        issues.push({
          ...this.issues.find(issue => issue.id === "GAS-001")!,
          line: i + 1,
          contract: contractName
        });
      }
    }

    return issues;
  }

  private checkMEVVulnerabilities(sourceCode: string, contractName: string): SecurityIssue[] {
    const issues: SecurityIssue[] = [];
    
    // Check for MEV protection mechanisms
    const mevProtectionPatterns = [
      /Flashbots/g,
      /private.*mempool/g,
      /bundle.*submission/g
    ];

    const hasMEVProtection = mevProtectionPatterns.some(pattern => pattern.test(sourceCode));
    
    if (!hasMEVProtection) {
      issues.push({
        ...this.issues.find(issue => issue.id === "MEV-001")!,
        contract: contractName
      });
    }

    return issues;
  }

  private checkPriceManipulationRisks(sourceCode: string, contractName: string): SecurityIssue[] {
    const issues: SecurityIssue[] = [];
    
    // Check for single oracle usage
    const oraclePatterns = [
      /Chainlink/g,
      /oracle/g,
      /price.*feed/g
    ];

    const hasOracle = oraclePatterns.some(pattern => pattern.test(sourceCode));
    
    if (hasOracle) {
      // Check for multiple oracle sources
      const multipleOraclePatterns = [
        /multiple.*oracle/g,
        /oracle.*aggregation/g,
        /deviation.*check/g
      ];

      const hasMultipleOracles = multipleOraclePatterns.some(pattern => pattern.test(sourceCode));
      
      if (!hasMultipleOracles) {
        issues.push({
          ...this.issues.find(issue => issue.id === "PRICE-001")!,
          contract: contractName
        });
      }
    }

    return issues;
  }

  private checkFlashLoanVulnerabilities(sourceCode: string, contractName: string): SecurityIssue[] {
    const issues: SecurityIssue[] = [];
    
    // Check for flash loan attack vectors
    const flashLoanPatterns = [
      /flash.*loan/g,
      /borrow.*repay/g,
      /instant.*loan/g
    ];

    const hasFlashLoan = flashLoanPatterns.some(pattern => pattern.test(sourceCode));
    
    if (hasFlashLoan) {
      // Check for proper validation
      const validationPatterns = [
        /require.*balance/g,
        /check.*balance/g,
        /validate.*amount/g
      ];

      const hasValidation = validationPatterns.some(pattern => pattern.test(sourceCode));
      
      if (!hasValidation) {
        issues.push({
          ...this.issues.find(issue => issue.id === "FLASH-001")!,
          contract: contractName
        });
      }
    }

    return issues;
  }

  private calculateSecurityScore(issues: SecurityIssue[]): number {
    let score = 100;
    
    issues.forEach(issue => {
      switch (issue.severity) {
        case 'critical':
          score -= 25;
          break;
        case 'high':
          score -= 15;
          break;
        case 'medium':
          score -= 10;
          break;
        case 'low':
          score -= 5;
          break;
        case 'info':
          score -= 2;
          break;
      }
    });
    
    return Math.max(0, score);
  }

  private determineRiskLevel(score: number): 'safe' | 'low' | 'medium' | 'high' | 'critical' {
    if (score >= 90) return 'safe';
    if (score >= 75) return 'low';
    if (score >= 50) return 'medium';
    if (score >= 25) return 'high';
    return 'critical';
  }

  private createEmptyReport(contractName: string): SecurityReport {
    return {
      contract: contractName,
      issues: [],
      score: 100,
      riskLevel: 'safe'
    };
  }

  async scanAllContracts(): Promise<SecurityReport[]> {
    console.log(chalk.bold.blue("🔒 SECURITY SCANNER - ADVANCED DEFI ARBITRAGE ENGINE"));
    console.log(chalk.blue("=".repeat(60)));
    console.log("");

    const contracts = [
      "AdvancedArbitrageEngine",
      "AIArbitrageStrategy",
      "AdvancedMEVProtector",
      "PriceOracle",
      "CrossChainBridge",
      "BalancerV2Integration",
      "CurveFinanceIntegration"
    ];

    const reports: SecurityReport[] = [];

    for (const contract of contracts) {
      try {
        const report = await this.scanContract(contract);
        reports.push(report);
      } catch (error) {
        console.log(chalk.red(`❌ Failed to scan ${contract}: ${error}`));
      }
    }

    this.displaySecuritySummary(reports);
    return reports;
  }

  private displaySecuritySummary(reports: SecurityReport[]) {
    console.log(chalk.bold.blue("\n📊 SECURITY SCAN SUMMARY"));
    console.log(chalk.blue("=".repeat(50)));

    const totalIssues = reports.reduce((sum, report) => sum + report.issues.length, 0);
    const criticalIssues = reports.reduce((sum, report) => 
      sum + report.issues.filter(issue => issue.severity === 'critical').length, 0);
    const highIssues = reports.reduce((sum, report) => 
      sum + report.issues.filter(issue => issue.severity === 'high').length, 0);

    console.log(chalk.white(`Total Contracts Scanned: ${reports.length}`));
    console.log(chalk.white(`Total Issues Found: ${totalIssues}`));
    console.log(chalk.red(`Critical Issues: ${criticalIssues}`));
    console.log(chalk.yellow(`High Issues: ${highIssues}`));
    console.log("");

    // Display individual contract reports
    reports.forEach(report => {
      const riskColor = this.getRiskColor(report.riskLevel);
      console.log(`${riskColor}${report.contract} (Score: ${report.score}/100, Risk: ${report.riskLevel.toUpperCase()})`);
      
      if (report.issues.length > 0) {
        report.issues.forEach(issue => {
          const severityColor = this.getSeverityColor(issue.severity);
          console.log(chalk.gray(`  • ${severityColor}${issue.severity.toUpperCase()}: ${issue.title}`));
          if (issue.line) {
            console.log(chalk.gray(`    Line ${issue.line}: ${issue.description}`));
          }
        });
      } else {
        console.log(chalk.green("  • No security issues found"));
      }
      console.log("");
    });

    // Overall assessment
    const averageScore = reports.reduce((sum, report) => sum + report.score, 0) / reports.length;
    const overallRisk = this.determineRiskLevel(averageScore);
    const overallColor = this.getRiskColor(overallRisk);

    console.log(chalk.bold.white("Overall Assessment:"));
    console.log(`${overallColor}Average Security Score: ${averageScore.toFixed(1)}/100`);
    console.log(`${overallColor}Overall Risk Level: ${overallRisk.toUpperCase()}`);
    console.log("");

    if (criticalIssues > 0) {
      console.log(chalk.bold.red("🚨 CRITICAL: Immediate action required!"));
    } else if (highIssues > 0) {
      console.log(chalk.bold.yellow("⚠️  WARNING: High priority issues need attention"));
    } else if (averageScore >= 90) {
      console.log(chalk.bold.green("✅ EXCELLENT: Security standards met"));
    } else {
      console.log(chalk.bold.blue("📈 GOOD: Minor improvements recommended"));
    }
  }

  private getRiskColor(riskLevel: string): any {
    switch (riskLevel) {
      case 'safe': return chalk.green;
      case 'low': return chalk.blue;
      case 'medium': return chalk.yellow;
      case 'high': return chalk.red;
      case 'critical': return chalk.bold.red;
      default: return chalk.white;
    }
  }

  private getSeverityColor(severity: string): any {
    switch (severity) {
      case 'critical': return chalk.bold.red;
      case 'high': return chalk.red;
      case 'medium': return chalk.yellow;
      case 'low': return chalk.blue;
      case 'info': return chalk.gray;
      default: return chalk.white;
    }
  }

  // Public methods for external use
  getReports(): SecurityReport[] {
    return this.reports;
  }

  getIssues(): SecurityIssue[] {
    return this.issues;
  }
}

// Main execution
async function main() {
  const scanner = new SecurityScanner();
  
  try {
    await scanner.scanAllContracts();
    
    console.log(chalk.bold.green("\n🎉 Security scan completed!"));
    
  } catch (error) {
    console.error(chalk.red("❌ Security scan failed:"), error);
    process.exit(1);
  }
}

// Export for use in other modules
export { SecurityScanner };

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}
