import { Injectable, Module } from '@nestjs/common';
import { MongoClient } from 'mongodb';

@Injectable()
export class MongoDb {
  constructor(private readonly connection: string) {}

  findAll(collectionName: string) {
    return new Promise((res) => {
      MongoClient.connect(this.connection, (err, client) => {
        if (err) throw err;
        const db = client.db('devdb');
        db.collection(collectionName).find({}).toArray((err, docs) => {
          if (err) throw err;
          res(docs)
        });
        client.close();
      });
    });
  }

  insert(collectionName: string, value) {
    return new Promise((res) => {
      MongoClient.connect(this.connection, (err, client) => {
        if (err) throw err;
        const db = client.db('devdb');
        db.collection(collectionName).insertMany([value], (err, r) => {
          if (err) throw err;
          res(r)
        });
        client.close();
      });
    });
  }
}


@Module({
})
export class MondoDbModule {
  static forRoot(options: {database: { connectionString: string }}) {
    return {
      module: MondoDbModule,
      providers: [
        {
          provide: MongoDb,
          useFactory: () => new MongoDb(options.database.connectionString),
          deps: []
        },
      ],
      exports: [MongoDb]
    };
  }
}