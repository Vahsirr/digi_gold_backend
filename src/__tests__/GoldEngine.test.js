const GoldEngine = require('../services/GoldEngine');

describe('GoldEngine Service', () => {
    test('should have an initial price', () => {
        const price = GoldEngine.getCurrentPrice();
        expect(price).toBeGreaterThan(0);
    });

    test('should lock price correctly', async () => {
        const userId = 'user123';
        const lock = await GoldEngine.lockPrice(userId);

        expect(lock).toHaveProperty('lockId');
        expect(lock).toHaveProperty('lockedPrice');
        expect(lock).toHaveProperty('expiry');
        expect(lock.lockedPrice).toBe(GoldEngine.currentPrice);
    });

    test('should verify valid lock', async () => {
        const userId = 'user123';
        const lock = await GoldEngine.lockPrice(userId);

        const verification = GoldEngine.verifyLock(lock.lockId, userId);
        expect(verification.valid).toBe(true);
        expect(verification.price).toBe(lock.lockedPrice);
    });

    test('should reject invalid user for lock', async () => {
        const userId = 'user123';
        const lock = await GoldEngine.lockPrice(userId);

        const verification = GoldEngine.verifyLock(lock.lockId, 'wrongUser');
        expect(verification.valid).toBe(false);
        expect(verification.message).toBe('Unauthorized lock');
    });

    test('should calculate incentive correctly', () => {
        // Day 1-75: 5%
        expect(GoldEngine.calculateIncentive(1000, 10)).toBe(50);
        // Day 76-150: 3%
        expect(GoldEngine.calculateIncentive(1000, 100)).toBe(30);
        // Day 151-225: 3%
        expect(GoldEngine.calculateIncentive(1000, 200)).toBe(30);
        // Day 226-330: 1%
        expect(GoldEngine.calculateIncentive(1000, 300)).toBe(10);
    });
});
