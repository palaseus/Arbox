import { expect } from "chai";
import { ethers } from "hardhat";
import { RateLimiter } from "../typechain-types/contracts/protection/RateLimiter";

describe("Debug Test", function () {
  let rateLimiter: RateLimiter;
  let owner: any;
  let user1: any;

  beforeEach(async function () {
    [owner, user1] = await ethers.getSigners();

    const RateLimiter = await ethers.getContractFactory("RateLimiter");
    rateLimiter = await RateLimiter.deploy();
  });

  it("should debug rate limiter function", async function () {
    const limitId = ethers.keccak256(ethers.toUtf8Bytes("test_limit"));
    await rateLimiter.setRateLimit(limitId, 10, 60);
    
    console.log("About to call checkRateLimit...");
    
    try {
      // Check rate limit (view function)
      const result = await rateLimiter.checkRateLimit(limitId, await user1.getAddress());
      console.log("Check rate limit result:", result);
      console.log("Result[0]:", result[0]);
      console.log("Result[1]:", result[1]);
      
      expect(result[0]).to.be.true;
      expect(result[1]).to.equal(0);
      
      // Record the request
      await rateLimiter.recordRequest(limitId, await user1.getAddress());
      console.log("Request recorded successfully");
      
    } catch (error) {
      console.error("Error:", error);
      throw error;
    }
  });
});
