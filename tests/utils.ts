import { ethers } from "ethers";

export const getEventData = (
	eventName: string,
	contract: ethers.Contract,
	txResult: ethers.ContractReceipt
): unknown => {
	if (!Array.isArray(txResult.logs)) return null;
	for (const log of txResult.logs) {
		try {
			const decoded = contract.interface.parseLog(log);
			if (decoded.name === eventName)
				return {
					...decoded,
					...decoded.args
				};
		} catch (error) {}
	}
	return null;
};
