import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/p2p-procurement';

const DEFAULT_GLOBAL_CATEGORIES = [
  { categoryName: 'Mechanical', description: 'Castings, forgings, machined parts, and mechanical assemblies' },
  { categoryName: 'Electrical', description: 'Wiring harnesses, transformers, switches, and electrical components' },
  { categoryName: 'Raw Materials', description: 'Sheet metal, steel bars, aluminum extrusions, and bulk raw stock' },
  { categoryName: 'Electronics', description: 'PCBs, microcontrollers, sensors, and electronic subsystems' },
  { categoryName: 'Fasteners', description: 'Bolts, nuts, screws, rivets, washers, and industrial hardware' },
  { categoryName: 'Plastics & Polymers', description: 'Injection molded parts, rubber seals, gaskets, and polymer goods' },
  { categoryName: 'Hydraulics & Pneumatics', description: 'Valves, cylinders, hoses, fittings, and fluid power equipment' },
  { categoryName: 'Tooling & Dies', description: 'Jigs, fixtures, molds, cutting tools, and custom dies' },
  { categoryName: 'Packaging', description: 'Corrugated boxes, protective pallets, crating, and packaging supplies' },
  { categoryName: 'General', description: 'General procurement supplies and non-categorized components' }
];

async function run() {
  await mongoose.connect(MONGODB_URI);
  const col = mongoose.connection.collection('companycategories');
  for (const cat of DEFAULT_GLOBAL_CATEGORIES) {
    await col.updateOne(
      { categoryName: cat.categoryName },
      { $set: { ...cat, isGlobal: true, createdAt: new Date(), updatedAt: new Date() } },
      { upsert: true }
    );
  }
  const count = await col.countDocuments();
  console.log('Seeded global categories. Total now:', count);
  await mongoose.disconnect();
}

run().catch(console.error);
