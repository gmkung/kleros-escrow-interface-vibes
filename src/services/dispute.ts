import { ethers } from "ethers";
import { Dispute, DisputeStatus, Ruling } from "../types/dispute";
import { KlerosEscrowConfig } from "../types/config";
import { BaseService } from "../base/BaseService";

/**
 * Service for reading dispute data from the Kleros Escrow contract
 */
export class DisputeService extends BaseService {
  /**
   * Creates a new DisputeService instance
   * @param config The Kleros Escrow configuration
   * @param provider Optional provider for read operations
   */
  constructor(
    config: KlerosEscrowConfig,
    provider?: ethers.providers.Provider
  ) {
    super(config, provider);
  }

  /**
   * Gets dispute information for a transaction
   * @param transactionId The ID of the transaction
   * @returns The dispute data if it exists
   */
  async getDispute(transactionId: string): Promise<Dispute | null> {
    const tx = await this.escrowContract.transactions(transactionId);

    if (tx.disputeId.toNumber() === 0) {
      return null;
    }

    const disputeId = tx.disputeId.toNumber();
    const arbitrator = await this.getArbitratorAddress();
    const arbitratorExtraData = await this.getArbitratorExtraData();

    let status = DisputeStatus.Waiting;
    let ruling = undefined;
    let appealPeriodStart = undefined;
    let appealPeriodEnd = undefined;

    // Initialize arbitrator contract if needed
    const minimalAbi = [
      "function disputeStatus(uint) view returns (uint)",
      "function currentRuling(uint) view returns (uint)",
      "function appealPeriod(uint) view returns (uint, uint)",
    ];

    try {
      const arbitratorContract = await this.getArbitratorContract(minimalAbi);

      const disputeStatus = await arbitratorContract.disputeStatus(disputeId);
      status = this.mapDisputeStatus(disputeStatus);

      const currentRuling = await arbitratorContract.currentRuling(disputeId);
      ruling = this.mapRuling(currentRuling);

      // Try to get appeal period if available
      try {
        const appealPeriod = await arbitratorContract.appealPeriod(disputeId);
        appealPeriodStart = appealPeriod[0].toNumber();
        appealPeriodEnd = appealPeriod[1].toNumber();
      } catch (e) {
        // Appeal period might not be available for all arbitrators
      }
    } catch (e) {
      // If any call fails, we'll use the default values
      console.warn("Could not get complete dispute details:", e);
    }

    return {
      id: disputeId,
      transactionId,
      status,
      ruling,
      arbitrator,
      arbitratorExtraData,
      evidenceGroupId: transactionId, // In this contract, evidenceGroupId is the same as transactionId
      appealPeriodStart,
      appealPeriodEnd,
    };
  }

  /**
   * Gets the arbitration cost for creating a dispute
   * @returns The arbitration cost in wei as a string
   */
  async getArbitrationCost(): Promise<string> {
    const arbitratorExtraData = await this.getArbitratorExtraData();

    const arbitratorAbi = [
      "function arbitrationCost(bytes) view returns (uint)",
    ];
    const arbitratorContract = await this.getArbitratorContract(arbitratorAbi);

    const cost = await arbitratorContract.arbitrationCost(arbitratorExtraData);
    return cost.toString();
  }

  /**
   * Gets the appeal cost for a dispute
   * @param disputeId The ID of the dispute
   * @returns The appeal cost in wei as a string
   */
  async getAppealCost(disputeId: number): Promise<string> {
    const arbitratorExtraData = await this.getArbitratorExtraData();

    const arbitratorAbi = [
      "function arbitrationCost(bytes) view returns (uint)",
      "function appealCost(uint, bytes) view returns (uint)",
    ];
    const arbitratorContract = await this.getArbitratorContract(arbitratorAbi);

    const cost = await arbitratorContract.appealCost(
      disputeId,
      arbitratorExtraData
    );
    return cost.toString();
  }

  /**
   * Maps numeric dispute status from arbitrator to enum
   * @param status The numeric status from the contract
   * @returns The corresponding DisputeStatus enum value
   */
  private mapDisputeStatus(status: number): DisputeStatus {
    const statusMap: Record<number, DisputeStatus> = {
      0: DisputeStatus.Waiting,
      1: DisputeStatus.Appealable,
      2: DisputeStatus.Solved,
    };

    return statusMap[status] || DisputeStatus.Waiting;
  }

  /**
   * Maps numeric ruling from arbitrator to enum
   * @param ruling The numeric ruling from the contract
   * @returns The corresponding Ruling enum value
   */
  private mapRuling(ruling: number): Ruling {
    const rulingMap: Record<number, Ruling> = {
      0: Ruling.RefusedToRule,
      1: Ruling.SenderWins,
      2: Ruling.ReceiverWins,
    };

    return rulingMap[ruling] || Ruling.RefusedToRule;
  }

  /**
   * Gets the fee timeout period
   * @returns The fee timeout in seconds
   */
  async getFeeTimeout(): Promise<number> {
    const timeout = await this.escrowContract.feeTimeout();
    return timeout.toNumber();
  }
}
