import fastify from "fastify";
import {MinecraftServerAdaptor} from "../minecraftServerAdaptor/MinecraftServerAdaptor";
import {routes} from "./routes";
import {DistributedNode, RAFTSave, RaftState} from "./node/distributedNodeInterface";
import axios, {AxiosError} from "axios";
import {clearInterval} from "timers";
import {HEARTBEAT_INTERVAL, HEARTBEAT_TIMER} from "./node/timers";
import {RAFTconsensus} from "./RAFTconsensus";
import {FileWatcher} from "../fileSync/worldFileSync";
import {saveToFile} from "../file-util/FileUtil";
import Connection from "../network/connection";
import {NetworkManager} from "./node/NetworkManager";

let ENV: string = process.env.NODE_ENV;

export default class DistributedServerNode {
    // Network
    public connection: Connection;

    // Main Server
    public mainServer: any;

    // Filewatcher
    public fileWatcher: FileWatcher;

    // Network Manager
    public networkManager: NetworkManager;

    // Internal data
    public isPrimaryNode: boolean;
    public inNetwork: boolean;
    public networkNodes: DistributedNode[];
    public uuid: string;
    public primaryNode: DistributedNode;
    public selfNode: DistributedNode;
    public alive: boolean;

    // Routine IDs
    public heartbeatId: any;
    public heartbeatTimerId: any;

    // Raft Consensus
    public raftSave: RAFTSave;
    public RAFTConsensus: RAFTconsensus;

    private baseRaftSave: RAFTSave = {
        currentTerm: 0,
        votedFor: null,
        state: RaftState.FOLLOWER,
    };

    constructor(
        connection: Connection,
        isPrimaryNode: boolean,
        inNetwork: boolean,
        networkNodes: DistributedNode[],
        uuid: string,
        raftSave: RAFTSave
    ) {
        this.connection = connection;
        this.isPrimaryNode = isPrimaryNode || false;
        this.inNetwork = inNetwork || false;
        this.uuid = uuid || null;
        this.alive = true;
        this.updateSelfNode();
        this.networkNodes = networkNodes || [];
        this.primaryNode = this.findPrimaryNode();
        this.raftSave = raftSave || this.baseRaftSave;
        this.networkManager = new NetworkManager(this);
    }

    public findPrimaryNode(): DistributedNode | null {
        for (const node of this.networkNodes) {
            if (node.isPrimary) {
                return node;
            }
        }
        return null;
    }

    /*
     * If the current node is a primary server and if the environment is production, start the minecraft world
     */
    private initiateMinecraftServer(): void {
        if (ENV === "production" && this.isPrimaryNode) {
            DistributedServerNode.initMCServerApplication();
            this.fileWatcher.startWatching();
        }
    }

    /*
     * Given a nodelist, update network and set primary node from network
     */
    public updateNodeList(nodeList: DistributedNode[]) {
        this.networkNodes = nodeList;
        this.primaryNode = this.findPrimaryNode();
    }

    /*
     * Initiate Raft election
     */
    public async start() {
        this.RAFTConsensus = new RAFTconsensus(
            this.raftSave.currentTerm,
            this.raftSave.votedFor,
            this.raftSave.state,
            this
        );
        await this.initDistributedServer();
        this.initRoutines();
        this.fileWatcher = new FileWatcher(["../minecraft-server"], this);
        this.initiateMinecraftServer()
        this.initProcesses();
    }

    /*
     * Reset heartbeat routine and close HTTP server
     */
    public async stop(): Promise<void> {
        // Stop your routines and clear intervals
        this.resetRoutines();
        const closeServer = () => {
            return new Promise<void>((resolve) => {
                this.mainServer.close((err) => {
                    if (err) {
                        console.error("Error while stopping the main server:", err);
                    } else {
                        console.log("Main server stopped.");
                    }
                    resolve();
                });
            });
        };

        // Stop the main server asynchronously
        await closeServer();

        // Stop the Minecraft server
        if (this.isPrimaryNode) {
            await MinecraftServerAdaptor.shutdownMinecraftServer();
            this.fileWatcher.stopWatching();
        }
        console.log("Server stopped");
    }

    /*
     * Open a new HTTP server, define HTTP routes, and accept HTTP requests
     */
    private async initDistributedServer(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this.mainServer = fastify({
                bodyLimit: 500 * 1024 * 1024, // 10MB limit
            });

            // Define a route
            routes(this.mainServer, this);

            // Start the server on the specified port
            this.mainServer.listen(this.connection.getHttpPort(), this.connection.getAddress(), async (err, address) => {
                if (err) {
                    console.error(err);
                    reject(err);
                } else {
                    console.log(`Server listening at ${address}`);
                    resolve();
                }
            });
        });
    }

    public static initMCServerApplication(): void {
        MinecraftServerAdaptor.startMinecraftServer("../minecraft-server");
    }

    /*
     * Initiate event listeners on crashes
     */
    private initProcesses() {
        process.on("beforeExit", async () => {
            if (this.isPrimaryNode) {
                await MinecraftServerAdaptor.shutdownMinecraftServer();
                await sleep(2000);
            }
        });

        process.on("SIGINT", async () => {
            if (this.isPrimaryNode) {
                await MinecraftServerAdaptor.shutdownMinecraftServer();
                await sleep(2000);
            }
            process.exit(1);
        });

        process.on("SIGTERM", async () => {
            if (this.isPrimaryNode) {
                await MinecraftServerAdaptor.shutdownMinecraftServer();
                await sleep(2000);
            }
            process.exit(1);
        });
    }


    public getServerInformation() {
        const raftState = this.RAFTConsensus.saveFile();
        return {
            node: this.selfNode,
            network: this.networkNodes,
            primary: this.primaryNode,
            raftState: raftState,
        };
    }

    public updateSelfNode() {
        this.selfNode = {
            uuid: this.uuid,
            address: this.connection.getAddress(),
            distributedPort: this.connection.getHttpPort(),
            minecraftPort: this.connection.getMinecraftPort(),
            alive: this.alive,
            isPrimary: this.isPrimaryNode
        };
    }

    // Distributed Node Network functions
    public async createNetwork() {
        await this.networkManager.createNetwork();
    }

    public async requestNetwork({address}) {
        await this.networkManager.requestNetwork({address});
    }

    public async acceptJoinNetwork(node: DistributedNode) {
        await this.networkManager.acceptJoinNetwork(node);
    }

    public async requestLeaveNetwork() {
        await this.networkManager.requestLeaveNetwork();
    }

    public async acceptLeaveNetwork(node: DistributedNode) {
        await this.networkManager.acceptLeaveNetwork(node);
    }

    public async removeNetworkNode(uuid: string) {
        await this.networkManager.removeNetworkNode(uuid);
    }

    private sendPutRequest(node: DistributedNode): Promise<void> {
        const url = `http://${node.address}:${node.distributedPort}/update-network`;
        return axios
            .put(url, this.networkNodes)
            .then(() => console.log(`PUT request to ${url} successful.`))
            .catch((error: AxiosError) => {
                console.error(`Error in PUT request to ${url}:`, error.message);
                //Test if server is dead
            });
    }

    public async propagateNetworkNodeList(): Promise<void> {
        const requestPromises = this.networkNodes.map((node) => {
            // Dont send to itself
            if (node.uuid != this.uuid) {
                this.sendPutRequest(node);
            }
        });

        try {
            await Promise.all(requestPromises);
            console.log("All network list propagation completed successfully.");
        } catch (error) {
            console.error("At least one PUT request failed:", error.message);
        }
    }

    public initRoutines() {
        this.resetRoutines();
        this.initHeartbeatRoutine();
        console.log(`Complete Routine Setup for ${this.uuid}`);
    }

    public resetRoutines() {
        this.heartbeatId && clearInterval(this.heartbeatId);
        this.heartbeatTimerId && clearInterval(this.heartbeatTimerId);
    }


    public initHeartbeatRoutine() {
        if (this.inNetwork) {
            if (this.isPrimaryNode) {
                this.heartbeatId = setInterval(async () => {
                    //Send hearbeat to all servers
                    await this.propagateHeartbeat();
                }, HEARTBEAT_INTERVAL);
            } else {
                // Set up the timer to check for heartbeats every 5 seconds
                this.heartbeatTimerId = setInterval(this.handlePrimaryFailure, HEARTBEAT_TIMER); // Check every 5 seconds
            }
        }
    }

    private async sendHeartbeatRequest(node: DistributedNode): Promise<void> {
        const url = `http://${node.address}:${node.distributedPort}/heartbeat`;
        return axios
            .get(url, {timeout: 4000})
            .then(() => {
                if (node.alive == false) {
                    node.alive = true;
                    this.propagateNetworkNodeList();
                }
            })
            .catch((error: AxiosError) => {
                if (node.alive) {
                    console.log(node.uuid, " has failed");
                    node.alive = false;
                    this.propagateNetworkNodeList();
                }
            });
    }

    public async propagateHeartbeat(): Promise<void> {
        const requestPromises = this.networkNodes.map((node) => {
            if (node.uuid != this.uuid) {
                this.sendHeartbeatRequest(node);
            }
        });

        try {
            await Promise.all(requestPromises);
            console.log(`Heartbeat for ${this.uuid} complete`);
        } catch (error) {
            console.error("At least one PUT request failed:", error.message);
        }
    }

    public async handlePrimaryFailure() {
        console.log("Detected Primary failure");
        if (this.primaryNode) {
            this.primaryNode.alive = false;
        }
        clearInterval(this.heartbeatTimerId);
        const baseDelay = Math.pow(2, 3) * 100;
        const randomFactor = Math.random() + 0.5;
        const electionDelay = Math.min(baseDelay * randomFactor, 13000);
        await sleep(electionDelay);
        console.log("Starting Raft Election");
        this.RAFTConsensus.startElection();
    }

    public resetHeartbeatTimer() {
        try {
            if (this.heartbeatTimerId) {
                clearInterval(this.heartbeatTimerId);
            }
            this.heartbeatTimerId = setInterval(() => {
                this.handlePrimaryFailure();
            }, HEARTBEAT_TIMER);
        } catch (error) {
            console.error("An error occurred while resetting the heartbeat timer:", error);
        }
    }

    public handleRequestVote(candidateTerm, candidateId) {
        return this.RAFTConsensus.requestVoteHandler(candidateTerm, candidateId);
    }

    public async assumeLeadership() {
        this.isPrimaryNode = true;
        this.updateSelfNode();
        this.primaryNode.isPrimary = false;
        await this.removeNetworkNode(this.uuid);
        this.networkNodes.push(this.selfNode);
        this.primaryNode = this.findPrimaryNode();
        this.initRoutines();
        await this.propagateLeadershipNotification();
        this.fileWatcher = new FileWatcher(["../minecraft-server"], this);
        this.fileWatcher.startWatching();
        this.RAFTConsensus.state = RaftState.LEADER;
        DistributedServerNode.initMCServerApplication();
        await saveToFile(this);
    }

    public async acceptLeadership(data) {
        this.RAFTConsensus.clearElectionTimeout();
        this.networkNodes = data;
        this.primaryNode = this.findPrimaryNode();
        this.initRoutines();
        await saveToFile(this);
    }

    private sendLeadershipNotification(node: DistributedNode): Promise<void> {
        const url = `http://${node.address}:${node.distributedPort}/new-leader`;
        return axios
            .post(url, this.networkNodes)
            .then(() => {
            })
            .catch((error: AxiosError) => {
            });
    }

    public async propagateLeadershipNotification(): Promise<void> {
        const requestPromises = this.networkNodes.map((node) => {
            if (node.uuid != this.uuid && node.alive) {
                this.sendLeadershipNotification(node);
            }
        });

        try {
            await Promise.all(requestPromises);
            console.log("Notified all alive node of its leadership");
        } catch (error) {
            console.error("At least one PUT request failed:", error.message);
        }
    }

    async recoveryStart() {
        await this.initDistributedServer();

        const findPrimary = async (node) => {
            try {
                const response = await axios.get(`http://${node.address}:${node.distributedPort}/info`, {timeout: 4000});
                const {primary} = response.data.info;
                return {response, primary};
            } catch (error) {
                console.error(`Error querying node ${node.address}:${node.distributedPort}:`, error.message);
                return {response: null, primary: null};
            }
        };

        const handlePrimaryResponse = async (response, primary) => {
            if (response && response.status === 200) {
                console.log(response.status);

                if (primary.uuid == this.uuid) {
                    console.log("Self still a leader");
                    this.initRoutines();
                    this.fileWatcher = new FileWatcher(["../minecraft-server"], this);
                    this.initiateMinecraftServer();
                    this.initProcesses();
                } else {
                    await this.handleRecovery(primary);
                }

                return true;
            }

            return false;
        };

        for (const node of this.networkNodes) {
            if (node.uuid !== this.uuid) {
                const {response, primary} = await findPrimary(node);
                const handled = await handlePrimaryResponse(response, primary);

                if (handled) {
                    return;
                }
            }
        }

        console.log("Nobody responded, Self still leader");
        this.handleSelfLeader();
    }

    async handleRecovery(primary) {
        console.log("Starting Recovery Process...");
        const URL = `http://${primary.address}:${primary.distributedPort}/request-recovery`;
        const RAFTURL = `http://${primary.address}:${primary.distributedPort}/raft-state`;

        const response = await axios.put(URL, {failedNode: this.selfNode});
        this.networkNodes = response.data.networkNodes;
        this.primaryNode = this.findPrimaryNode();
        this.isPrimaryNode = false;

        // Update self node
        this.updateSelfNode();

        const raftResponse = await axios.get(RAFTURL);
        const primaryRaftSave = raftResponse.data.raftState;
        this.raftSave = {
            currentTerm: primaryRaftSave.currentTerm,
            votedFor: null,
            state: RaftState.FOLLOWER,
        };
        this.RAFTConsensus = new RAFTconsensus(
            this.raftSave.currentTerm,
            this.raftSave.votedFor,
            this.raftSave.state,
            this
        );

        this.initRoutines();
        this.fileWatcher = new FileWatcher(["../minecraft-server"], this);
        await this.fileWatcher.recovery();
        this.initProcesses();
        await saveToFile(this);
        console.log(this.uuid, " Recovery complete");
    }

    handleSelfLeader() {
        this.RAFTConsensus = new RAFTconsensus(
            this.raftSave.currentTerm,
            this.raftSave.votedFor,
            this.raftSave.state,
            this
        );
        this.initRoutines();
        this.fileWatcher = new FileWatcher(["../minecraft-server"], this);
        this.initiateMinecraftServer();
        this.initProcesses();
    }


    public async recoverNode(node: DistributedNode) {
        let foundNode = this.networkNodes.find((networkNode) => networkNode.uuid === node.uuid);

        if (foundNode) {
            foundNode.alive = true;
        } else {
            this.networkNodes.push(node);
            await this.propagateNetworkNodeList();
        }
    }
}

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
