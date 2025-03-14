"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ArbitratorService = void 0;
const BaseService_1 = require("../base/BaseService");
/**
 * Service for reading arbitrator data
 */
class ArbitratorService extends BaseService_1.BaseService {
    /**
     * Creates a new ArbitratorService instance
     * @param config The Kleros Escrow configuration
     * @param provider Optional provider for read operations
     */
    constructor(config, provider) {
        super(config, provider);
    }
    /**
     * Gets information about the arbitrator
     * @returns The arbitrator information
     */
    async getArbitrator() {
        // Get the arbitrator address and extra data directly
        const address = await this.getArbitratorAddress();
        const extraData = await this.getArbitratorExtraData();
        // Create or reuse the arbitrator contract
        const minimalAbi = [
            "function arbitrationCost(bytes) view returns (uint)",
            "function appealCost(uint, bytes) view returns (uint)",
            "function getSubcourt(uint) view returns (uint)",
            "function disputes(uint) view returns (uint, uint, uint, uint, uint, uint, uint, uint, uint, uint, address, address, bytes, uint)",
            "function currentRuling(uint) view returns (uint)",
            "function disputeStatus(uint) view returns (uint)",
        ];
        const arbitratorContract = await this.getArbitratorContract(minimalAbi);
        // Get arbitration costs
        const arbitrationCost = await arbitratorContract.arbitrationCost(extraData);
        // For appeal cost, we need a dispute ID, but we don't have one here
        const appealCost = "0"; // Placeholder
        return {
            address,
            arbitrationCost: arbitrationCost.toString(),
            appealCost,
        };
    }
    /**
     * Gets the fee timeout period
     * @returns The fee timeout in seconds
     */
    async getFeeTimeout() {
        const timeout = await this.escrowContract.feeTimeout();
        return timeout.toNumber();
    }
    /**
     * Gets the subcourt ID used for disputes
     * @returns The subcourt ID
     */
    async getSubcourt() {
        const subcourt = await this.escrowContract.getSubcourt();
        return subcourt.toNumber();
    }
}
exports.ArbitratorService = ArbitratorService;
