import { createPasswordHash } from './admin';

const password = process.env.CLICKPULSE_ADMIN_PASSWORD;
if (!password) throw new Error('Set CLICKPULSE_ADMIN_PASSWORD without placing the password in shell history');
console.log(createPasswordHash(password));
