import OpenAI from 'openai';

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  const vectorStoreId = process.env.OPENAI_VECTOR_STORE_ID;
  if (!apiKey || !vectorStoreId) throw new Error('OPENAI_API_KEY and OPENAI_VECTOR_STORE_ID are required');
  const client = new OpenAI({ apiKey });
  const [store, files, sample] = await Promise.all([
    client.vectorStores.retrieve(vectorStoreId),
    client.vectorStores.files.list(vectorStoreId),
    client.vectorStores.search(vectorStoreId, { query: '产品需求验证和用户痛点', max_num_results: 3 }),
  ]);
  console.log(JSON.stringify({ id: store.id, fileCount: files.data.length, sample: sample.data.map((item) => item.filename) }, null, 2));
  if (!files.data.length || !sample.data.length) process.exitCode = 1;
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
