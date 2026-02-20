// backend/src/middlewares/validate.js
function formatZodErrors(zodError) {
  return zodError.issues
    .slice(0, 5)
    .map((i) => ({
      campo: i.path?.length ? i.path.join(".") : "(root)",
      mensaje: i.message,
    }));
}

function validate({ params, query, body }) {
  return (req, res, next) => {
    try {
      if (params) {
        const r = params.safeParse(req.params);
        if (!r.success) {
          return res.status(400).json({
            ok: false,
            mensaje: "Validación fallida (params)",
            errores: formatZodErrors(r.error),
          });
        }
        req.params = r.data;
      }

      if (query) {
        const r = query.safeParse(req.query);
        if (!r.success) {
          return res.status(400).json({
            ok: false,
            mensaje: "Validación fallida (query)",
            errores: formatZodErrors(r.error),
          });
        }
        req.query = r.data;
      }

      if (body) {
        const r = body.safeParse(req.body);
        if (!r.success) {
          return res.status(400).json({
            ok: false,
            mensaje: "Validación fallida (body)",
            errores: formatZodErrors(r.error),
          });
        }
        req.body = r.data;
      }

      return next();
    } catch (e) {
      return next(e);
    }
  };
}

module.exports = { validate };
