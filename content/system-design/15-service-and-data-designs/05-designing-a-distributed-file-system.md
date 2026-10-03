---
title: "Designing a Distributed File System (GFS and HDFS)"
short_title: "Distributed File System (GFS/HDFS)"
tags: ["distributed-file-system", "gfs", "hdfs", "replication", "metadata", "design"]
sources:
  - "Ghemawat, Gobioff and Leung, 'The Google File System' (SOSP 2003)"
  - "Shvachko, Kuang, Radia and Chansler, 'The Hadoop Distributed File System' (MSST 2010)"
  - "Apache Hadoop documentation: HDFS architecture, erasure coding and NameNode high availability, hadoop.apache.org"
predict:
  question: "A cluster holds 100 million small files, each only a few KB. What is the main problem for the NameNode?"
  options: ["Almost no memory is used, because metadata size follows file size and these files are tiny", "Roughly 100 MB of heap, because only block locations are kept in memory", "Tens of gigabytes of heap, because each file costs about 150 bytes regardless of its size"]
  answer: 2
  why: "Each file, directory and block costs roughly 150 bytes of NameNode memory. So 100 million files consume tens of gigabytes however small they are."
check:
  - q: "Why do clients read data directly from data servers instead of through the metadata server?"
    options: ["Keeping it out of the data path avoids a throughput bottleneck", "Data servers hold the only copy of each file namespace entry", "It lets the metadata server verify checksums for every read"]
    answer: 0
    why: "The client only asks the metadata server where a block lives. Bulk data flows between client and data servers, so one metadata machine does not cap throughput."
  - q: "Why does HDFS put the second and third replicas on the same remote rack?"
    options: ["All three replicas should sit on different racks for the strongest survival", "All three replicas should sit on one rack to avoid cross-rack write traffic", "It balances write bandwidth against surviving a rack failure"]
    answer: 2
    why: "One replica is local, the other two share a different rack. That limits cross-rack write traffic yet still survives losing the writer's rack."
  - q: "Which data should be erasure coded, and why?"
    options: ["Hot data, because 50% overhead matters most where reads are frequent", "Cold data, because reads and reconstruction cost extra network and CPU", "Any data, because erasure coding has no read-time cost over replication"]
    answer: 1
    why: "Erasure coding cuts storage from 3x to 1.5x but costs network and CPU on reads and reconstruction. Doing it on hot data pays that cost on every read."
---

## The problem

Batch-processing frameworks need to store and read **huge files** (gigabytes to terabytes) across thousands of cheap machines, with high aggregate throughput and automatic handling of the constant disk and machine failures that large clusters experience. A single server's file system cannot hold or serve that volume, and general network file systems were not built for failure as the normal case.

## Requirements and workload assumptions

Google's File System paper states the assumptions that shaped the design, and HDFS inherited them:

- **Failures are routine**: with thousands of machines, some are always down.
- **Files are large** and **mostly appended**, rarely overwritten randomly.
- **Reads are mostly large streaming reads**; high **throughput** matters more than low latency.
- **Few clients write the same file concurrently**, but many append.
- **Scale (example)**: 10,000 nodes, 100 PB, files averaging 1 GB.

## Architecture

- **One metadata server (GFS master, HDFS NameNode)** holds the namespace (directories, files), the mapping from each file to its **chunks (blocks)**, and the locations of each chunk's replicas. Keeping metadata in one machine's memory makes lookups fast and the design simple.
- **Many data servers (chunkservers, DataNodes)** store the actual blocks (64 MB in GFS; 128 MB by default in HDFS) as files on local disks.
- **Clients** ask the metadata server where a block lives, then **talk directly to data servers** for the data, so the single metadata server is not in the data path and does not become a throughput bottleneck.

Large blocks reduce metadata per file: a 1 TB file at 128 MB blocks is 8,192 blocks, a manageable amount of metadata per file, whereas 4 KB blocks would be 268 million.

## Replication and placement

Each block is stored on **3 replicas** by default. HDFS's rack-aware placement puts one replica on the writer's node, a second on a different rack, and a third on another node in that second rack, balancing write bandwidth against survival of a rack failure. The metadata server tracks replica counts; when a data server dies (detected by missed **heartbeats**), it schedules **re-replication** of the lost blocks from surviving copies. Data servers periodically send **block reports** so the metadata server's view stays accurate.

Triple replication costs 200% storage overhead. Modern HDFS supports **erasure coding** (for example Reed-Solomon 6 data plus 3 parity blocks, 50% overhead, tolerating any 3 losses) for cold data, at the price of more network traffic and CPU on reads and reconstruction.

## Write and read paths

- **Write**: the client asks the metadata server for block locations; it streams data to the first replica, which forwards in a **pipeline** to the second and third (so the client's outbound bandwidth is used once); acknowledgements flow back; the client then asks for the next block. The file becomes visible on close (or on explicit sync).
- **Read**: the client gets the block locations (sorted by network distance) and reads from the closest replica, falling back to another on failure or a **checksum** mismatch (each block carries checksums verified on read).
- **Append**: GFS offers a record-append operation that makes concurrent appends atomic at least once, with the system choosing the offset; applications tolerate duplicates and padding.

## The metadata server problem

A single master is a **single point of failure and a memory limit**. Solutions:

- **Operation log and checkpoints**: every namespace change is first written to a durable log (replicated to other machines) and periodically checkpointed, so a restarted master replays quickly.
- **High availability**: HDFS added a hot **standby NameNode** that tails a shared edit log (through quorum journal nodes) and takes over within seconds, with fencing so the old active cannot write.
- **Federation**: multiple independent namespaces (NameNodes) share the same pool of data servers, splitting the metadata load.
- **Small files hurt**: each file, directory and block costs roughly 150 bytes of NameNode memory, so 100 million small files consume tens of gigabytes of heap regardless of their size. Combine small files into larger containers (sequence files, Parquet, object stores).

## A worked example

A cluster of 2,000 nodes with 100 PB of raw capacity stores 33 PB of logical data at 3x replication.

1. A node fails; the NameNode notices after missing heartbeats for 10 minutes, finds 40,000 blocks that dropped to 2 replicas, and schedules copies across many nodes in parallel, restoring full replication in about 15 minutes.
2. A job reads a 10 GB file (80 blocks) with 80 parallel tasks scheduled **on or near the nodes holding each block** (data locality), so most reads never cross the network core.
3. The active NameNode crashes; the standby, current via the journal quorum, becomes active in about 30 seconds; clients retry transparently.
4. Cold logs older than 90 days are converted to erasure coding (6+3), cutting their storage from 3x to 1.5x.

## Common mistakes

- **Millions of tiny files** exhausting metadata memory.
- **Ignoring rack awareness**, so one rack failure loses all replicas.
- **Treating the metadata server as stateless** and skipping the operation log.
- **Using it for low-latency random access**, which it was not designed for.
- **Erasure coding hot data**, paying reconstruction cost on every read.
