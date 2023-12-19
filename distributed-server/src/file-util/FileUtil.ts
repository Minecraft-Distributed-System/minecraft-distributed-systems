import path from "path";
import DistributedServerNode from "../distributedNode/distributedNode";
import fs from "fs";
import Connection from "../network/connection";

export const FILEPATH: string = path.join(__dirname, "distributedNode", "node", "save.json");

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