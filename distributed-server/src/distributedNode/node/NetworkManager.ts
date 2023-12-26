import {DistributedNode, RAFTSave, RaftState} from "./distributedNodeInterface";
import {v4 as uuidv4} from "uuid";
import {saveToFile} from "../../file-util/FileUtil";
import {FileWatcher} from "../../fileSync/worldFileSync";
import DistributedServerNode from "../distributedNode";
import axios from "axios";
import {RAFTconsensus} from "../RAFTconsensus";
import {MinecraftServerAdaptor} from "../../minecraftServerAdaptor/MinecraftServerAdaptor";

export class NetworkManager {

    private distributedServerNode: DistributedServerNode;

    constructor(distributedServerNode: DistributedServerNode) {
        this.distributedServerNode = distributedServerNode;
    }

    public async createNetwork({username}) {
        this.distributedServerNode.isPrimaryNode = true;
        this.distributedServerNode.inNetwork = true;
        this.distributedServerNode.uuid = uuidv4();
        this.distributedServerNode.RAFTConsensus.state = RaftState.LEADER;
        this.distributedServerNode.username = username;
        this.distributedServerNode.updateSelfNode();
        this.distributedServerNode.networkNodes = [this.distributedServerNode.selfNode];
        this.distributedServerNode.primaryNode = this.distributedServerNode.findPrimaryNode();
        this.distributedServerNode.initRoutines();
        saveToFile(this.distributedServerNode);
        DistributedServerNode.initMCServerApplication();
        this.distributedServerNode.fileWatcher = new FileWatcher(["../minecraft-server"], this.distributedServerNode);
        this.distributedServerNode.fileWatcher.startWatching();
    }

    public async requestNetwork({address,username}) {
        const requestURL = `${address}/join-network`;
        const RAFTURL = `${address}/raft-state`;
        this.distributedServerNode.uuid = uuidv4();
        this.distributedServerNode.updateSelfNode();
        try {
            const results = await axios.put(requestURL, this.distributedServerNode.selfNode);
            console.log("Network Join is successful");
            // Update own network
            this.distributedServerNode.inNetwork = true;
            this.distributedServerNode.networkNodes = results.data.data;
            this.distributedServerNode.primaryNode = this.distributedServerNode.findPrimaryNode();
            this.distributedServerNode.username = username;

            const raftResponse = await axios.get(RAFTURL);
            const primaryRAFTSave: RAFTSave = raftResponse.data.raftState;
            this.distributedServerNode.raftSave = {
                currentTerm: primaryRAFTSave.currentTerm,
                votedFor: null,
                state: RaftState.FOLLOWER,
            };
            this.distributedServerNode.RAFTConsensus = new RAFTconsensus(
                this.distributedServerNode.raftSave.currentTerm,
                this.distributedServerNode.raftSave.votedFor,
                this.distributedServerNode.raftSave.state,
                this.distributedServerNode
            );

            this.distributedServerNode.initRoutines();
            saveToFile(this.distributedServerNode);
        } catch (error) {
            // Handle the error
            console.error("Error joining network:", error);
        }
    }

    public async acceptJoinNetwork(node: DistributedNode) {
        this.distributedServerNode.networkNodes.push(node);
        // Propagate all nodes to network
        await this.distributedServerNode.propagateNetworkNodeList();
        saveToFile(this.distributedServerNode);
        return this.distributedServerNode.networkNodes;
    }

    public async requestLeaveNetwork() {
        // If it is primary, remove itself from all other nodes in the server
        if (this.distributedServerNode.isPrimaryNode) {
            await this.distributedServerNode.acceptLeaveNetwork(this.distributedServerNode.selfNode);
            await MinecraftServerAdaptor.shutdownMinecraftServer();
            console.log("Complete shutdown of processes");
        } else {
            // If not, tell primary to remove itself from all other nodes in the server
            const requestURL = `http://${this.distributedServerNode.primaryNode.address}:${this.distributedServerNode.primaryNode.distributedPort}/leave-network`;
            try {
                const results = await axios.put(requestURL, this.distributedServerNode.selfNode);
                console.log("Leave Successful");
            } catch (error) {
                // Handle the error
                console.error("Error joining network:", error.message);
            }
        }

        this.distributedServerNode.primaryNode = null;
        this.distributedServerNode.isPrimaryNode = false;
        this.distributedServerNode.networkNodes = [];
        this.distributedServerNode.uuid = null;
        this.distributedServerNode.inNetwork = false;
        this.distributedServerNode.updateSelfNode();
        this.distributedServerNode.initRoutines();

        // RESET RAFT STATES
        this.distributedServerNode.RAFTConsensus = new RAFTconsensus(
            this.distributedServerNode.raftSave.currentTerm,
            this.distributedServerNode.raftSave.votedFor,
            this.distributedServerNode.raftSave.state,
            this.distributedServerNode
        );
        saveToFile(this.distributedServerNode);
    }

    public async acceptLeaveNetwork(node: DistributedNode) {
        await this.distributedServerNode.removeNetworkNode(node.uuid);
        await this.distributedServerNode.propagateNetworkNodeList();
        saveToFile(this.distributedServerNode);
    }

    public removeNetworkNode(uuid: string) {
        const indexToRemove = this.distributedServerNode.networkNodes.findIndex((node) => node.uuid === uuid);
        if (indexToRemove !== -1) {
            this.distributedServerNode.networkNodes.splice(indexToRemove, 1);
        } else {
            console.warn(`Network node with UUID ${uuid} not found.`);
        }
        console.log(this.distributedServerNode.networkNodes);
    }


}