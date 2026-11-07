const SHOPS = require('./_shops');
module.exports = (req, res) => {
  res.setHeader('Cache-Control', 's-maxage=3600');
  res.json(SHOPS.map(({ id, name, region, cur, default: d }) => ({ id, name, region, cur, default: !!d })));
};
