import { parse } from 'url'
import { MongoClient } from 'mongodb'

let cachedDb

const connectToDb = async (uri) => {
  if (cachedDb) {
    return cachedDb
  }

  const client = await MongoClient.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true })
  const db = client.db(parse(uri).pathname.substr(1))

  cachedDb = db
  return db
}

export default connectToDb