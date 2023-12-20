import DistributedServerNode from "../distributedNode/distributedNode";
import fs from "fs";
import Connection from "../network/connection";

export const FILEPATH: string ="./src/distributedNode/node/save.json";

export async function loadFromFile(): Promise<DistributedServerNode | null> {
    try {
        const data = fs.readFileSync(FILEPATH, "utf8");
        const parsedData = JSON.parse(data);

        // Assuming DistributedServerNode is your class
        let connection: Connection = new Connection(parsedData.address, parsedData.mainPort, parsedData.minecraftPort);

        const node = new DistributedServerNode(
            connection,
            parsedData.isPrimaryNode,
            parsedData.inNetwork,
            parsedData.networkNodes,
            parsedData.uuid,
            parsedData.raftSave
        );
        await node.recoveryStart();
        console.log("DistributedServerNode loaded from file successfully.");
        return node;
    } catch (err) {
        console.error("Error reading/parsing DistributedServerNode from file");
        return null;
    }
}

export function saveToFile(node: DistributedServerNode) {
    try {
        const serializableNode = {
            mainPort: node.connection.getHttpPort(),
            minecraftPort: node.connection.getMinecraftPort(),
            address: node.connection.getAddress(),
            isPrimaryNode: node.isPrimaryNode,
            inNetwork: node.inNetwork,
            uuid: node.uuid,
            networkNodes: node.networkNodes.map((node) => ({...node})),
            primaryNode: node.primaryNode,
            selfNode: {...node.selfNode},
            alive: node.alive,
            raftSave: node.RAFTConsensus.saveFile(),
        };

        const serializedNode = JSON.stringify(serializableNode, null, 2);
        fs.writeFileSync(FILEPATH, serializedNode, "utf8");
        console.log("DistributedServerNode saved to file successfully.");
    } catch (err) {
        console.error("Error saving DistributedServerNode to file:", err);
    }
}

