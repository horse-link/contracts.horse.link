import { ethers as tsEthers } from "ethers";
import * as ERC20 from "./ERC20";
import * as Vault from "./Vault";
import * as Market from "./Market";
import * as MarketOracle from "./MarketOracle";
import * as Registry from "./Registry";

export interface DeploymentModule {
  contractNames: (...params: any) => string[];
  constructorArguments: (addresses?: any) => any[];
  deploy: (
    deployer: tsEthers.Signer,
    setAddresses: Function,
    addresses?: any
  ) => Promise<tsEthers.Contract>;
  upgrade?: (deployer: tsEthers.Signer, addresses?: any) => void;
}

const modules: DeploymentModule[] = [
  ERC20,
  Vault,
  Market,
  MarketOracle,
  Registry
];

export default modules;
