// validate({ body, query, params }) parses each part with its zod schema and replaces it with
// the parsed (coerced, defaulted, stripped) value. Express 5 makes req.query a getter, so the
// parsed query is stored on req.validQuery instead.
function validate(schemas) {
  return (req, _res, next) => {
    if (schemas.params) req.params = schemas.params.parse(req.params);
    if (schemas.query) req.validQuery = schemas.query.parse(req.query);
    if (schemas.body) req.body = schemas.body.parse(req.body ?? {});
    next();
  };
}

module.exports = validate;
