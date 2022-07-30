const ethers = require('ethers');
const { performance } = require('perf_hooks');

const uniswapV3_factory_ABI = require('./uniswapV3_factory.json');
const erc20_ABI = require('./erc20.json');

const PILOT = '0x37C997B35C619C21323F3518B9357914E8B99525';
const PILOT_START_BLOCK = 12865058;
const TRANSFER_EVENT_SIGNATURE = 'Transfer(address,address,uint256)';
const UNISWAP_V3_FACTORY = '0x1F98431c8aD98523631AE4a59f267346ea31F984';
const START_BLOCK = 12369621;
const EVENT_SIGNATURE = 'PoolCreated(address,address,uint24,int24,address)';

const UNISWAP_V3_INTERFACE = new ethers.utils.Interface(uniswapV3_factory_ABI);

const unindexedInputs = UNISWAP_V3_INTERFACE.events[EVENT_SIGNATURE].inputs.filter(
  input => !input.indexed
);
const indexedInputs = UNISWAP_V3_INTERFACE.events[EVENT_SIGNATURE].inputs.filter(
  input => input.indexed
);

const getProvider = () => {
  return new ethers.providers.StaticJsonRpcProvider(
    'https://eth-mainnet.gateway.pokt.network/v1/5f3453978e354ab992c4da79'
  );
};

const getLatestBlock = async () => {
  const provider = getProvider();
  return await provider.getBlockNumber();
};

const getLogs = async params => {
  const provider = getProvider();

  const filter = {
    address: params.target,
    topics: params.topics ?? [ethers.utils.id(params.topic)],
    fromBlock: params.fromBlock,
    toBlock: params.toBlock,
  };

  let logs = [];
  let blockSpread = params.toBlock - params.fromBlock;
  let currentBlock = params.fromBlock;

  console.log('From block => ', params.fromBlock);
  console.log('To block => ', params.toBlock);
  console.log('Total blocks to sync => ', blockSpread);
  console.log('\n');

  while (currentBlock < params.toBlock) {
    const nextBlock = Math.min(params.toBlock, currentBlock + blockSpread);

    try {
      const partLogs = await provider.getLogs({
        ...filter,
        fromBlock: currentBlock,
        toBlock: nextBlock,
      });
      logs = logs.concat(partLogs);
      console.log(
        `Synced ${
          nextBlock - currentBlock
        } blocks, from block = ${currentBlock} to block = ${nextBlock}`
      );
      currentBlock = nextBlock;
    } catch (e) {
      if (blockSpread >= 2e3) {
        blockSpread = Math.floor(blockSpread / 2);
      } else {
        throw e;
      }
    }
  }

  return logs;
};

const decodeData = logs => {
  const decoder = new ethers.utils.AbiCoder();

  const decodedInformation = logs.map(log => {
    //remove index 0 topic becuase it contains only hash of event signature
    const topics = log.topics.slice(1, log.topics.length);
    return {
      data: decoder.decode(unindexedInputs, log.data),
      topics: topics.map((topic, index) => decoder.decode([indexedInputs[index]], topic)),
    };
  });

  return decodedInformation;
};

const getData = async () => {
  const startTime = performance.now();

  const latestBlock = await getLatestBlock();

  //   const logs = await getLogs({
  //     // topics: [
  //     //   ethers.utils.id(EVENT_SIGNATURE),
  //     //   ethers.utils.hexZeroPad(PILOT, 32), null,
  //     // ],
  //     target: UNISWAP_V3_FACTORY,
  //     topic: EVENT_SIGNATURE,
  //     //fromBlock: latestBlock - 1000,
  //     fromBlock: START_BLOCK,
  //     toBlock: latestBlock,
  //   });

  const logs = await getLogs({
    target: PILOT,
    topic: TRANSFER_EVENT_SIGNATURE,
    fromBlock: PILOT_START_BLOCK,
    toBlock: latestBlock,
  });

  console.log('logs => ', logs.length);

  //   const logsData = decodeData(logs);
  //   console.log('logsData => ', logsData);

  const endTime = performance.now();
  console.log(`Execution time: ${endTime - startTime} ms`);
};

getData();
