import DistributedServerNode from "./distributedNode/distributedNode";
import Connection from "./network/connection";
import {loadFromFile} from "./file-util/FileUtil";

async function main(): Promise<void> {
    let connection: Connection = new Connection();
    let node: DistributedServerNode = await loadFromFile();
    if (node === null) {
        node = new DistributedServerNode(connection, null, null, null, null, null);
        await node.start();
    }
    console.log("Distributed System has started!"); // Print a message to the console
}

main();
