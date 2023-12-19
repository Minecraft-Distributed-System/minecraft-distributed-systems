export interface DistributedNode {
    uuid: string;
    address: string;
    distributedPort: number;
    minecraftPort: number;
    alive: boolean;
    isPrimary: boolean;
}

export interface RAFTSave {
    currentTerm: number;
    votedFor: string;
    state: RaftState;
}

export enum RaftState {
    FOLLOWER = "follower",
    CANDIDATE = "candidate",
    LEADER = "leader",
}
