const { network, ethers } = require("hardhat")
const {
    networkConfig,
    developmentChains,
    VERIFICATION_BLOCK_CONFIRMATIONS,
} = require("../helper-hardhat-config")
const { verify } = require("../utils/verify")
const { parseEther } = ethers.utils

const FUND_AMOUNT = parseEther("0.01"); // 1 Ether, or 1e18 (10^18) Wei


module.exports = async function ({ getNamedAccounts, deployments }) {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()
    const chainId = network.config.chainId
    let vrfCoordinatorV2Address;
    let subscriptionId;
    let vrfCoordinatorV2Mock;

        if (chainId == 31_337) {
            // create VRFV2 Subscription
            const vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer);
            vrfCoordinatorV2Address = vrfCoordinatorV2Mock.address;
            const transactionResponse = await vrfCoordinatorV2Mock.createSubscription();
            const transactionReceipt = await transactionResponse.wait(1);
            if (transactionReceipt.events && transactionReceipt.events.length > 0) {
                subscriptionId = 1;
            } else {
                console.error("No events found in transaction receipt");
            }
            // Fund the subscription
            // Our mock makes it so we don't actually have to worry about sending fund
            await vrfCoordinatorV2Mock.fundSubscription(subscriptionId, FUND_AMOUNT)
        } else {
            vrfCoordinatorV2Address = networkConfig[chainId]["vrfCoordinatorV2"]
            subscriptionId = networkConfig[chainId]["subscriptionId"]
             // Check if vrfCoordinatorV2Mock is defined (for development testing)
    if (vrfCoordinatorV2Mock) {
        await vrfCoordinatorV2Mock.addConsumer(subscriptionId, raffle.address)
    }
        }
        const waitBlockConfirmations = developmentChains.includes(network.name)
            ? 1
            : VERIFICATION_BLOCK_CONFIRMATIONS

        log("----------------------------------------------------")
        const arguments = [
            vrfCoordinatorV2Address,
            networkConfig[chainId]["raffleEntranceFee"],
            networkConfig[chainId]["gasLane"],
            subscriptionId,
            networkConfig[chainId]["keepersUpdateInterval"],
            networkConfig[chainId]["callbackGasLimit"],
        ]
        const raffle = await deploy("Raffle", {
            from: deployer,
            args: arguments,
            log: true,
            waitConfirmations: waitBlockConfirmations,
        })

        // Ensure the Raffle contract is a valid consumer of the VRFCoordinatorV2Mock contract.
        if (developmentChains.includes(network.name)) {
            const vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock")
            await vrfCoordinatorV2Mock.addConsumer(subscriptionId, raffle.address)
        }

        // Verify the deployment
        if (chainId == !31_337 && process.env.ETHERSCAN_API_KEY) {
            log("Verifying...")
            await verify(raffle.address, arguments)
        }

        log("Enter lottery with command:")
        const networkName = network.name == "hardhat" ? "localhost" : network.name
        log(`yarn hardhat run scripts/enterRaffle.js --network ${networkName}`)
        log("----------------------------------------------------")
}

module.exports.tags = ["all", "raffle"]

