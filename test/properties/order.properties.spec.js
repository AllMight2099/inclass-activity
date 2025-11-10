const fc = require('fast-check');

const { subtotal } = require('../../src/subtotal');
const { discounts } = require('../../src/discounts');
const { total } = require('../../src/total');
const { tax } = require('../../src/tax');
const { delivery } = require('../../src/delivery');

// These arbitrary generators provide primitive building blocks for constructing orders and contexts in property-based tests
//
// To learn more about primitives: https://fast-check.dev/docs/core-blocks/arbitraries/primitives
// To learn more about combiners: https://fast-check.dev/docs/core-blocks/arbitraries/combiners
const skuArb = fc.constantFrom('P6-POTATO', 'P12-POTATO', 'P24-POTATO', 'P6-SAUER', 'P12-SAUER');
const addOnArb = fc.constantFrom('sour-cream', 'fried-onion', 'bacon-bits');
const fillingArb = fc.constantFrom('potato', 'sauerkraut', 'sweet-cheese', 'mushroom');
const kindArb = fc.constantFrom('hot', 'frozen');
const tierArb = fc.constantFrom('guest', 'regular', 'vip');
const zoneArb = fc.constantFrom('local', 'outer');

// This composite arbitrary generator builds an order item object using the primitive building blocks defined above
// Each field in the object below specifies the arbitrary generator to use for that field
//
// To learn more about composite arbitraries: https://fast-check.dev/docs/core-blocks/arbitraries/composites

const deliveryArb = fc.record({
  distanceKm: fc.float({ min: 0, max: 100 }),
  zone: zoneArb,
  rush: fc.boolean()
});

const couponArb = fc.option(fc.constantFrom('PIEROGI-BOGO', 'FIRST10'), { nil: null });

const orderItemArb = fc.record({
  kind: kindArb,
  sku: skuArb,
  title: fc.string({ minLength: 0, maxLength: 24 }),
  filling: fillingArb,
  qty: fc.constantFrom(6, 12, 24),
  unitPriceCents: fc.integer({ min: 500, max: 3000 }),
  addOns: fc.array(addOnArb, { maxLength: 3 })
});

// We use the orderItemArb defined above to build an order object that contains an array of order items
const orderArb = fc.record({
  id: fc.uuid(),
  items: fc.array(orderItemArb, { minLength: 1, maxLength: 5 }),
  delivery: fc.option(deliveryArb, { nil: { distanceKm: 1, zone: 'local', rush: false } }),
  customer: fc.record({ tier: tierArb }, { requiredKeys: ['tier'] }),
  coupon: couponArb
});


// ------------------------------------------------------------------------------
// To test discounts, tax, delivery and total, you will need to add more
// arbitraries to represent the context in which an order is placed.
//
// You will find the following building blocks helpful:
//
// fc.boolean() - to represent true/false flags
// fc.constantFrom(...) - to represent enumerated values
// fc.record({ ... }) - to build composite objects
// fc.optional(...) - to represent optional fields
// ------------------------------------------------------------------------------


describe('Property-Based Tests for Orders', () => {
  it('subtotal should always be a non-negative integer', () => {
    fc.assert(
      fc.property(orderArb, (order) => {
        const result = subtotal(order);
        return Number.isInteger(result) && result >= 0;
      }),
      { numRuns: 50 }
    );
  });

  it('total equals subtotal - discounts + delivery + tax (clamped at zero)', () => {
    fc.assert(
      fc.property(orderArb, (order) => {
        const s = subtotal(order);
        const d = discounts(order); // adapt if discounts returns an object
        const del = delivery(order); // adapt if delivery returns an object
        const t = tax(order);
        const tot = total(order);

        assert.ok(Number.isInteger(s), 'subtotal must be integer cents');
        assert.ok(Number.isInteger(d), 'discounts must be integer cents');
        assert.ok(Number.isInteger(del), 'delivery must be integer cents');
        assert.ok(Number.isInteger(t), 'tax must be integer cents');
        assert.ok(Number.isInteger(tot), 'total must be integer cents');

        const expected = Math.max(0, s - d + del + t);
        assert.strictEqual(tot, expected);
        return true;
      }),
      { numRuns: 500 }
    );
  });

  describe('Invariants', () => {
    it('tax is zero for all-frozen orders', () => {
      const allFrozen = orderArb.filter(o => o.items.every(it => it.kind === 'frozen'));
      fc.assert(
        fc.property(allFrozen, (order) => {
          const t = tax(order);
          assert.strictEqual(t, 0);
        }),
        { numRuns: 200 }
      );
    });

    it('discounts should never exceed subtotal', () => {
      fc.assert(
        fc.property(orderArb, (order) => {
          const s = subtotal(order);
          const d = discounts(order);
          
          assert.ok(d >= 0, 'discounts must be non-negative');
          assert.ok(d <= s, `discounts (${d}) should not exceed subtotal (${s})`);
          return true;
        }),
        { numRuns: 300 }
      );
    });

    it('orders with only hot items should have positive tax', () => {
      const allHot = orderArb.filter(o => o.items.every(it => it.kind === 'hot'));
      fc.assert(
        fc.property(allHot, (order) => {
          const t = tax(order);
          assert.ok(t > 0, `tax should be positive for hot items, got ${t}`);
          return true;
        }),
        { numRuns: 200 }
      );
    });

  });
});
