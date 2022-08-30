import migration_1_1_0 from './migration_1_1_0.js';
import migration_1_4_0 from './migration_1_4_0.js';

export default async function processMigrations() {
    await migration_1_1_0.processMigration();
    await migration_1_4_0.processMigration();
}
