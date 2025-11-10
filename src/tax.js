const { TaxAPI } = require('../apis/tax-api');

/**
 * Calculate tax for an order
  * 
 * @param {Object} order - The order object with items array
 * @param {Object} delivery - Delivery information (optional if order.delivery exists)
 * @returns {number} - Tax amount in cents
 */
function tax(order, delivery) {
  // Extract delivery from order if not provided separately
  const deliveryInfo = delivery || order.delivery || { zone: 'local', rush: false, distanceKm: 1 };
  
  let hasHotItems = false;
  let totalTax = 0;

  for (const item of order.items) {
    const itemTotal = item.unitPriceCents * item.qty;

    if (item.kind === 'hot') {
      const taxRate = TaxAPI.lookup(item.kind);
      const itemTax = Math.floor(itemTotal * taxRate);
      totalTax += itemTax;
      hasHotItems = true;
    }
    // Frozen items are tax-exempt (0% tax)
  }

  return totalTax;
}

module.exports = { tax };
