import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("Security Features", function () {
    let timeLock: Contract;
    let auditTrail: Contract;
    let mockTarget: Contract;
    let owner: Signer;
    let proposer: Signer;
    let executor: Signer;
    let canceller: Signer;
    let auditor: Signer;
    let compliance: Signer;
    let privacy: Signer;
    let user1: Signer;
    let user2: Signer;

    async function deploySecurityFeatures() {
        [owner, proposer, executor, canceller, auditor, compliance, privacy, user1, user2] = await ethers.getSigners();

        // Deploy TimeLock
        const TimeLock = await ethers.getContractFactory("TimeLock");
        timeLock = await TimeLock.deploy(
            86400, // 1 day min delay
            604800, // 1 week max delay
            3600, // 1 hour grace period
            2, // 2 required approvals
            await owner.getAddress()
        );

        // Deploy AuditTrail
        const AuditTrail = await ethers.getContractFactory("AuditTrail");
        auditTrail = await AuditTrail.deploy(
            10000, // max log entries
            2592000, // 30 days retention
            0, // privacy mode
            await owner.getAddress()
        );

        // Deploy mock target contract
        const MockTarget = await ethers.getContractFactory("MockTarget");
        mockTarget = await MockTarget.deploy();

        // Grant roles
        await timeLock.grantRole(await timeLock.PROPOSER_ROLE(), await proposer.getAddress());
        await timeLock.grantRole(await timeLock.EXECUTOR_ROLE(), await executor.getAddress());
        await timeLock.grantRole(await timeLock.CANCELLER_ROLE(), await canceller.getAddress());

        await auditTrail.grantRole(await auditTrail.AUDITOR_ROLE(), await auditor.getAddress());
        await auditTrail.grantRole(await auditTrail.COMPLIANCE_ROLE(), await compliance.getAddress());
        await auditTrail.grantRole(await auditTrail.PRIVACY_ROLE(), await privacy.getAddress());

        return { timeLock, auditTrail, mockTarget, owner, proposer, executor, canceller, auditor, compliance, privacy, user1, user2 };
    }

    describe("TimeLock", function () {
        beforeEach(async function () {
            ({ timeLock, auditTrail, mockTarget, owner, proposer, executor, canceller, auditor, compliance, privacy, user1, user2 } = await loadFixture(deploySecurityFeatures));
        });

        describe("Deployment", function () {
            it("Should deploy with correct initial parameters", async function () {
                expect(await timeLock.minDelay()).to.equal(86400);
                expect(await timeLock.maxDelay()).to.equal(604800);
                expect(await timeLock.gracePeriod()).to.equal(3600);
                expect(await timeLock.requiredApprovals()).to.equal(2);
            });

            it("Should grant correct roles to admin", async function () {
                expect(await timeLock.hasRole(await timeLock.DEFAULT_ADMIN_ROLE(), await owner.getAddress())).to.be.true;
                expect(await timeLock.hasRole(await timeLock.PROPOSER_ROLE(), await owner.getAddress())).to.be.true;
                expect(await timeLock.hasRole(await timeLock.EXECUTOR_ROLE(), await owner.getAddress())).to.be.true;
                expect(await timeLock.hasRole(await timeLock.CANCELLER_ROLE(), await owner.getAddress())).to.be.true;
            });
        });

        describe("Proposal Creation", function () {
            it("Should create proposal successfully", async function () {
                const target = await mockTarget.getAddress();
                const value = 0;
                const data = mockTarget.interface.encodeFunctionData("testFunction", []);
                const description = "Test proposal";

                const tx = await timeLock.connect(proposer).propose(target, value, data, description);
                const receipt = await tx.wait();
                const event = receipt?.logs.find((log: any) => 
                    log.eventName === "ProposalCreated"
                );

                expect(event).to.not.be.undefined;
                expect(event?.args?.target).to.equal(target);
                expect(event?.args?.description).to.equal(description);
            });

            it("Should revert if proposer doesn't have role", async function () {
                const target = await mockTarget.getAddress();
                const value = 0;
                const data = mockTarget.interface.encodeFunctionData("testFunction", []);
                const description = "Test proposal";

                await expect(
                    timeLock.connect(user1).propose(target, value, data, description)
                ).to.be.revertedWithCustomError(timeLock, "AccessControlUnauthorizedAccount");
            });

            it("Should revert with invalid target", async function () {
                const target = ethers.ZeroAddress;
                const value = 0;
                const data = mockTarget.interface.encodeFunctionData("testFunction", []);
                const description = "Test proposal";

                await expect(
                    timeLock.connect(proposer).propose(target, value, data, description)
                ).to.be.revertedWithCustomError(timeLock, "InvalidTarget");
            });

            it("Should revert with empty data", async function () {
                const target = await mockTarget.getAddress();
                const value = 0;
                const data = "0x";
                const description = "Test proposal";

                await expect(
                    timeLock.connect(proposer).propose(target, value, data, description)
                ).to.be.revertedWithCustomError(timeLock, "InvalidData");
            });
        });

        describe("Proposal Approval", function () {
            let proposalId: string;

            beforeEach(async function () {
                const target = await mockTarget.getAddress();
                const value = 0;
                const data = mockTarget.interface.encodeFunctionData("testFunction", []);
                const description = "Test proposal";

                const tx = await timeLock.connect(proposer).propose(target, value, data, description);
                const receipt = await tx.wait();
                const event = receipt?.logs.find((log: any) => 
                    log.eventName === "ProposalCreated"
                );
                proposalId = event?.args?.proposalId;
            });

            it("Should approve proposal successfully", async function () {
                const tx = await timeLock.connect(owner).approveProposal(proposalId);
                const receipt = await tx.wait();
                const event = receipt?.logs.find((log: any) => 
                    log.eventName === "ProposalApproved"
                );

                expect(event).to.not.be.undefined;
                expect(event?.args?.approver).to.equal(await owner.getAddress());
                expect(event?.args?.approvalCount).to.equal(1);
            });

            it("Should revert if approver doesn't have role", async function () {
                await expect(
                    timeLock.connect(user1).approveProposal(proposalId)
                ).to.be.revertedWithCustomError(timeLock, "AccessControlUnauthorizedAccount");
            });

            it("Should revert if already approved", async function () {
                await timeLock.connect(owner).approveProposal(proposalId);
                
                await expect(
                    timeLock.connect(owner).approveProposal(proposalId)
                ).to.be.revertedWithCustomError(timeLock, "AlreadyApproved");
            });

            it("Should track approval count correctly", async function () {
                await timeLock.connect(owner).approveProposal(proposalId);
                await timeLock.grantRole(await timeLock.DEFAULT_ADMIN_ROLE(), await proposer.getAddress());
                await timeLock.connect(proposer).approveProposal(proposalId);

                const proposal = await timeLock.getProposal(proposalId);
                expect(proposal.approvalCount).to.equal(2);
            });
        });

        describe("Proposal Execution", function () {
            let proposalId: string;

            beforeEach(async function () {
                const target = await mockTarget.getAddress();
                const value = 0;
                const data = mockTarget.interface.encodeFunctionData("testFunction", []);
                const description = "Test proposal";

                const tx = await timeLock.connect(proposer).propose(target, value, data, description);
                const receipt = await tx.wait();
                const event = receipt?.logs.find((log: any) => 
                    log.eventName === "ProposalCreated"
                );
                proposalId = event?.args?.proposalId;

                // Approve proposal
                await timeLock.connect(owner).approveProposal(proposalId);
                await timeLock.grantRole(await timeLock.DEFAULT_ADMIN_ROLE(), await proposer.getAddress());
                await timeLock.connect(proposer).approveProposal(proposalId);
            });

            it("Should revert if executed before delay", async function () {
                await expect(
                    timeLock.connect(executor).execute(proposalId)
                ).to.be.revertedWithCustomError(timeLock, "ProposalNotReady");
            });

            it("Should execute after delay period", async function () {
                // Fast forward time
                await ethers.provider.send("evm_increaseTime", [86400]); // 1 day
                await ethers.provider.send("evm_mine", []);

                const tx = await timeLock.connect(executor).execute(proposalId);
                const receipt = await tx.wait();
                const event = receipt?.logs.find((log: any) => 
                    log.eventName === "ProposalExecuted"
                );

                expect(event).to.not.be.undefined;
                expect(event?.args?.proposalId).to.equal(proposalId);
            });

            it("Should revert if executed after grace period", async function () {
                // Fast forward time beyond grace period
                await ethers.provider.send("evm_increaseTime", [86400 + 3600 + 1]); // 1 day + 1 hour + 1 second
                await ethers.provider.send("evm_mine", []);

                await expect(
                    timeLock.connect(executor).execute(proposalId)
                ).to.be.revertedWithCustomError(timeLock, "ProposalExpired");
            });

            it("Should revert if insufficient approvals", async function () {
                // Create new proposal with only 1 approval
                const target = await mockTarget.getAddress();
                const value = 0;
                const data = mockTarget.interface.encodeFunctionData("testFunction", []);
                const description = "Test proposal 2";

                const tx = await timeLock.connect(proposer).propose(target, value, data, description);
                const receipt = await tx.wait();
                const event = receipt?.logs.find((log: any) => 
                    log.eventName === "ProposalCreated"
                );
                const newProposalId = event?.args?.proposalId;

                // Only approve once
                await timeLock.connect(owner).approveProposal(newProposalId);

                // Fast forward time
                await ethers.provider.send("evm_increaseTime", [86400]);
                await ethers.provider.send("evm_mine", []);

                await expect(
                    timeLock.connect(executor).execute(newProposalId)
                ).to.be.revertedWithCustomError(timeLock, "InsufficientApprovals");
            });
        });

        describe("Proposal Cancellation", function () {
            let proposalId: string;

            beforeEach(async function () {
                const target = await mockTarget.getAddress();
                const value = 0;
                const data = mockTarget.interface.encodeFunctionData("testFunction", []);
                const description = "Test proposal";

                const tx = await timeLock.connect(proposer).propose(target, value, data, description);
                const receipt = await tx.wait();
                const event = receipt?.logs.find((log: any) => 
                    log.eventName === "ProposalCreated"
                );
                proposalId = event?.args?.proposalId;
            });

            it("Should cancel proposal successfully", async function () {
                const tx = await timeLock.connect(canceller).cancel(proposalId);
                const receipt = await tx.wait();
                const event = receipt?.logs.find((log: any) => 
                    log.eventName === "ProposalCancelled"
                );

                expect(event).to.not.be.undefined;
                expect(event?.args?.proposalId).to.equal(proposalId);
            });

            it("Should revert if canceller doesn't have role", async function () {
                await expect(
                    timeLock.connect(user1).cancel(proposalId)
                ).to.be.revertedWithCustomError(timeLock, "AccessControlUnauthorizedAccount");
            });

            it("Should revert if proposal already executed", async function () {
                // Approve and execute
                await timeLock.connect(owner).approveProposal(proposalId);
                await timeLock.grantRole(await timeLock.DEFAULT_ADMIN_ROLE(), await proposer.getAddress());
                await timeLock.connect(proposer).approveProposal(proposalId);
                
                await ethers.provider.send("evm_increaseTime", [86400]);
                await ethers.provider.send("evm_mine", []);
                
                await timeLock.connect(executor).execute(proposalId);

                await expect(
                    timeLock.connect(canceller).cancel(proposalId)
                ).to.be.revertedWithCustomError(timeLock, "ProposalAlreadyExecuted");
            });
        });

        describe("Configuration Updates", function () {
            it("Should update minimum delay", async function () {
                const newDelay = 172800; // 2 days
                const tx = await timeLock.connect(owner).updateMinDelay(newDelay);
                const receipt = await tx.wait();
                const event = receipt?.logs.find((log: any) => 
                    log.eventName === "DelayUpdated"
                );

                expect(event).to.not.be.undefined;
                expect(await timeLock.minDelay()).to.equal(newDelay);
            });

            it("Should update grace period", async function () {
                const newGracePeriod = 7200; // 2 hours
                const tx = await timeLock.connect(owner).updateGracePeriod(newGracePeriod);
                const receipt = await tx.wait();
                const event = receipt?.logs.find((log: any) => 
                    log.eventName === "GracePeriodUpdated"
                );

                expect(event).to.not.be.undefined;
                expect(await timeLock.gracePeriod()).to.equal(newGracePeriod);
            });

            it("Should update required approvals", async function () {
                const newRequired = 3;
                const tx = await timeLock.connect(owner).updateRequiredApprovals(newRequired);
                const receipt = await tx.wait();
                const event = receipt?.logs.find((log: any) => 
                    log.eventName === "RequiredApprovalsUpdated"
                );

                expect(event).to.not.be.undefined;
                expect(await timeLock.requiredApprovals()).to.equal(newRequired);
            });
        });
    });

    describe("AuditTrail", function () {
        beforeEach(async function () {
            ({ timeLock, auditTrail, mockTarget, owner, proposer, executor, canceller, auditor, compliance, privacy, user1, user2 } = await loadFixture(deploySecurityFeatures));
        });

        describe("Deployment", function () {
            it("Should deploy with correct initial parameters", async function () {
                expect(await auditTrail.maxLogEntries()).to.equal(10000);
                expect(await auditTrail.retentionPeriod()).to.equal(2592000);
                expect(await auditTrail.privacyMode()).to.equal(0);
            });

            it("Should grant correct roles to admin", async function () {
                expect(await auditTrail.hasRole(await auditTrail.DEFAULT_ADMIN_ROLE(), await owner.getAddress())).to.be.true;
                expect(await auditTrail.hasRole(await auditTrail.AUDITOR_ROLE(), await owner.getAddress())).to.be.true;
                expect(await auditTrail.hasRole(await auditTrail.COMPLIANCE_ROLE(), await owner.getAddress())).to.be.true;
                expect(await auditTrail.hasRole(await auditTrail.PRIVACY_ROLE(), await owner.getAddress())).to.be.true;
            });
        });

        describe("Log Entry Creation", function () {
            it("Should create log entry successfully", async function () {
                const operationHash = ethers.keccak256(ethers.toUtf8Bytes("test operation"));
                const user = await user1.getAddress();
                const contractAddress = await mockTarget.getAddress();
                const functionSelector = mockTarget.interface.getFunction("testFunction").selector;
                const data = "0x12345678";
                const description = "Test log entry";
                const level = 0; // INFO
                const category = 0; // ARBITRAGE

                const tx = await auditTrail.connect(auditor).createLogEntry(
                    operationHash,
                    user,
                    contractAddress,
                    functionSelector,
                    data,
                    description,
                    level,
                    category
                );
                const receipt = await tx.wait();
                const event = receipt?.logs.find((log: any) => 
                    log.eventName === "LogEntryCreated"
                );

                expect(event).to.not.be.undefined;
                expect(event?.args?.operationHash).to.equal(operationHash);
                expect(event?.args?.description).to.equal(description);
            });

            it("Should revert if auditor doesn't have role", async function () {
                const operationHash = ethers.keccak256(ethers.toUtf8Bytes("test operation"));
                const user = await user1.getAddress();
                const contractAddress = await mockTarget.getAddress();
                const functionSelector = mockTarget.interface.getFunction("testFunction").selector;
                const data = "0x12345678";
                const description = "Test log entry";
                const level = 0;
                const category = 0;

                await expect(
                    auditTrail.connect(user1).createLogEntry(
                        operationHash,
                        user,
                        contractAddress,
                        functionSelector,
                        data,
                        description,
                        level,
                        category
                    )
                ).to.be.revertedWithCustomError(auditTrail, "AccessControlUnauthorizedAccount");
            });

            it("Should revert with data too large", async function () {
                const operationHash = ethers.keccak256(ethers.toUtf8Bytes("test operation"));
                const user = await user1.getAddress();
                const contractAddress = await mockTarget.getAddress();
                const functionSelector = mockTarget.interface.getFunction("testFunction").selector;
                const data = "0x" + "1".repeat(2050); // Too large (1025 bytes = 2050 hex chars)
                const description = "Test log entry";
                const level = 0;
                const category = 0;

                await expect(
                    auditTrail.connect(auditor).createLogEntry(
                        operationHash,
                        user,
                        contractAddress,
                        functionSelector,
                        data,
                        description,
                        level,
                        category
                    )
                ).to.be.revertedWithCustomError(auditTrail, "DataTooLarge");
            });

            it("Should handle valid enum values", async function () {
                const operationHash = ethers.keccak256(ethers.toUtf8Bytes("test operation"));
                const user = await user1.getAddress();
                const contractAddress = await mockTarget.getAddress();
                const functionSelector = mockTarget.interface.getFunction("testFunction").selector;
                const data = "0x12345678";
                const description = "Test log entry";
                const level = 3; // CRITICAL
                const category = 5; // TECHNICAL

                const tx = await auditTrail.connect(auditor).createLogEntry(
                    operationHash,
                    user,
                    contractAddress,
                    functionSelector,
                    data,
                    description,
                    level,
                    category
                );
                const receipt = await tx.wait();
                const event = receipt?.logs.find((log: any) => 
                    log.eventName === "LogEntryCreated"
                );

                expect(event).to.not.be.undefined;
                expect(event?.args?.level).to.equal(3);
                expect(event?.args?.category).to.equal(5);
            });
        });

        describe("Log Entry Redaction", function () {
            let entryId: number;

            beforeEach(async function () {
                const operationHash = ethers.keccak256(ethers.toUtf8Bytes("test operation"));
                const user = await user1.getAddress();
                const contractAddress = await mockTarget.getAddress();
                const functionSelector = mockTarget.interface.getFunction("testFunction").selector;
                const data = "0x12345678";
                const description = "Test log entry";
                const level = 0;
                const category = 0;

                const tx = await auditTrail.connect(auditor).createLogEntry(
                    operationHash,
                    user,
                    contractAddress,
                    functionSelector,
                    data,
                    description,
                    level,
                    category
                );
                const receipt = await tx.wait();
                const event = receipt?.logs.find((log: any) => 
                    log.eventName === "LogEntryCreated"
                );
                entryId = event?.args?.entryId;
            });

            it("Should redact log entry successfully", async function () {
                const tx = await auditTrail.connect(privacy).redactLogEntry(entryId);
                const receipt = await tx.wait();
                const event = receipt?.logs.find((log: any) => 
                    log.eventName === "LogEntryRedacted"
                );

                expect(event).to.not.be.undefined;
                expect(event?.args?.entryId).to.equal(entryId);
            });

            it("Should revert if redactor doesn't have role", async function () {
                await expect(
                    auditTrail.connect(user1).redactLogEntry(entryId)
                ).to.be.revertedWithCustomError(auditTrail, "AccessControlUnauthorizedAccount");
            });

            it("Should revert if entry already redacted", async function () {
                await auditTrail.connect(privacy).redactLogEntry(entryId);
                
                await expect(
                    auditTrail.connect(privacy).redactLogEntry(entryId)
                ).to.be.revertedWithCustomError(auditTrail, "LogEntryAlreadyRedacted");
            });
        });

        describe("Privacy Features", function () {
            it("Should update privacy whitelist", async function () {
                const user = await user1.getAddress();
                const whitelisted = true;

                const tx = await auditTrail.connect(privacy).updatePrivacyWhitelist(user, whitelisted);
                const receipt = await tx.wait();
                const event = receipt?.logs.find((log: any) => 
                    log.eventName === "PrivacyWhitelistUpdated"
                );

                expect(event).to.not.be.undefined;
                expect(event?.args?.address_).to.equal(user);
                expect(event?.args?.whitelisted).to.equal(whitelisted);
            });

            it("Should enforce privacy mode", async function () {
                // Enable privacy mode
                await auditTrail.connect(privacy).updatePrivacyMode(1);

                const operationHash = ethers.keccak256(ethers.toUtf8Bytes("test operation"));
                const user = await user1.getAddress();
                const contractAddress = await mockTarget.getAddress();
                const functionSelector = mockTarget.interface.getFunction("testFunction").selector;
                const data = "0x12345678";
                const description = "Test log entry";
                const level = 0;
                const category = 0;

                // Should not create log entry for non-whitelisted user
                const tx = await auditTrail.connect(auditor).createLogEntry(
                    operationHash,
                    user,
                    contractAddress,
                    functionSelector,
                    data,
                    description,
                    level,
                    category
                );
                const receipt = await tx.wait();
                const event = receipt?.logs.find((log: any) => 
                    log.eventName === "LogEntryCreated"
                );

                expect(event).to.be.undefined;
            });
        });

        describe("Configuration Updates", function () {
            it("Should update retention period", async function () {
                const newRetentionPeriod = 5184000; // 60 days
                const tx = await auditTrail.connect(owner).updateRetentionPeriod(newRetentionPeriod);
                const receipt = await tx.wait();
                const event = receipt?.logs.find((log: any) => 
                    log.eventName === "RetentionPeriodUpdated"
                );

                expect(event).to.not.be.undefined;
                expect(await auditTrail.retentionPeriod()).to.equal(newRetentionPeriod);
            });

            it("Should update max log entries", async function () {
                const newMaxEntries = 20000;
                const tx = await auditTrail.connect(owner).updateMaxLogEntries(newMaxEntries);
                const receipt = await tx.wait();
                const event = receipt?.logs.find((log: any) => 
                    log.eventName === "MaxLogEntriesUpdated"
                );

                expect(event).to.not.be.undefined;
                expect(await auditTrail.maxLogEntries()).to.equal(newMaxEntries);
            });

            it("Should update privacy mode", async function () {
                const newPrivacyMode = 1;
                const tx = await auditTrail.connect(privacy).updatePrivacyMode(newPrivacyMode);
                const receipt = await tx.wait();
                const event = receipt?.logs.find((log: any) => 
                    log.eventName === "PrivacyModeUpdated"
                );

                expect(event).to.not.be.undefined;
                expect(await auditTrail.privacyMode()).to.equal(newPrivacyMode);
            });
        });

        describe("Query Functions", function () {
            let entryId: number;
            let operationHash: string;

            beforeEach(async function () {
                operationHash = ethers.keccak256(ethers.toUtf8Bytes("test operation"));
                const user = await user1.getAddress();
                const contractAddress = await mockTarget.getAddress();
                const functionSelector = mockTarget.interface.getFunction("testFunction").selector;
                const data = "0x12345678";
                const description = "Test log entry";
                const level = 0;
                const category = 0;

                const tx = await auditTrail.connect(auditor).createLogEntry(
                    operationHash,
                    user,
                    contractAddress,
                    functionSelector,
                    data,
                    description,
                    level,
                    category
                );
                const receipt = await tx.wait();
                const event = receipt?.logs.find((log: any) => 
                    log.eventName === "LogEntryCreated"
                );
                entryId = event?.args?.entryId;
            });

            it("Should get log entry by ID", async function () {
                const entry = await auditTrail.getLogEntry(entryId);
                expect(entry.entryId).to.equal(entryId);
                expect(entry.operationHash).to.equal(operationHash);
                expect(entry.description).to.equal("Test log entry");
            });

            it("Should get operation logs", async function () {
                const logs = await auditTrail.getOperationLogs(operationHash);
                expect(logs).to.include(entryId);
            });

            it("Should get user logs with proper permissions", async function () {
                const user = await user1.getAddress();
                const logs = await auditTrail.connect(auditor).getUserLogs(user);
                expect(logs).to.include(entryId);
            });

            it("Should revert getting user logs without permissions", async function () {
                const user = await user1.getAddress();
                await expect(
                    auditTrail.connect(user1).getUserLogs(user)
                ).to.be.revertedWithCustomError(auditTrail, "InsufficientPermissions");
            });

            it("Should get audit statistics", async function () {
                const stats = await auditTrail.getAuditStatistics();
                expect(stats[0]).to.be.greaterThan(0); // totalLogEntries (at least 1 from previous tests)
                expect(stats[1]).to.equal(0); // totalRedactedEntries
                expect(stats[3]).to.equal(10000); // maxLogEntries
                expect(stats[4]).to.equal(2592000); // retentionPeriod
            });
        });

        describe("Compliance Features", function () {
            it("Should perform compliance audit", async function () {
                const startTimestamp = Math.floor(Date.now() / 1000);
                const endTimestamp = startTimestamp + 3600;

                const tx = await auditTrail.connect(compliance).performComplianceAudit(startTimestamp, endTimestamp);
                const receipt = await tx.wait();

                expect(receipt).to.not.be.undefined;
            });

            it("Should revert compliance audit without role", async function () {
                const startTimestamp = Math.floor(Date.now() / 1000);
                const endTimestamp = startTimestamp + 3600;

                await expect(
                    auditTrail.connect(user1).performComplianceAudit(startTimestamp, endTimestamp)
                ).to.be.revertedWithCustomError(auditTrail, "AccessControlUnauthorizedAccount");
            });
        });
    });

    describe("Integration Tests", function () {
        beforeEach(async function () {
            ({ timeLock, auditTrail, mockTarget, owner, proposer, executor, canceller, auditor, compliance, privacy, user1, user2 } = await loadFixture(deploySecurityFeatures));
        });

        it("Should integrate TimeLock with AuditTrail", async function () {
            // Create a proposal
            const target = await mockTarget.getAddress();
            const value = 0;
            const data = mockTarget.interface.encodeFunctionData("testFunction", []);
            const description = "Test proposal";

            const tx = await timeLock.connect(proposer).propose(target, value, data, description);
            const receipt = await tx.wait();
            const event = receipt?.logs.find((log: any) => 
                log.eventName === "ProposalCreated"
            );
            const proposalId = event?.args?.proposalId;

            // Log the proposal creation
            const operationHash = ethers.keccak256(ethers.solidityPacked(["bytes32", "address"], [proposalId, target]));
            const user = await proposer.getAddress();
            const contractAddress = await timeLock.getAddress();
            const functionSelector = timeLock.interface.getFunction("propose").selector;
            const logData = timeLock.interface.encodeFunctionData("propose", [target, value, data, description]);

            await auditTrail.connect(auditor).createLogEntry(
                operationHash,
                user,
                contractAddress,
                functionSelector,
                logData,
                "TimeLock proposal created",
                0, // INFO
                3  // GOVERNANCE
            );

            // Verify both systems work together
            const proposal = await timeLock.getProposal(proposalId);
            expect(proposal.target).to.equal(target);

            const stats = await auditTrail.getAuditStatistics();
            expect(stats[0]).to.equal(1); // One log entry created
        });

        it("Should handle emergency scenarios", async function () {
            // Pause both systems
            await timeLock.connect(owner).pause();
            await auditTrail.connect(owner).pause();

            // Verify they are paused
            expect(await timeLock.paused()).to.be.true;
            expect(await auditTrail.paused()).to.be.true;

            // Resume operations
            await timeLock.connect(owner).unpause();
            await auditTrail.connect(owner).unpause();

            // Verify they are unpaused
            expect(await timeLock.paused()).to.be.false;
            expect(await auditTrail.paused()).to.be.false;
        });
    });
});
