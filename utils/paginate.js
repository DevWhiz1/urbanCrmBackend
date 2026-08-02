const getPaginationParams = (req) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limitQuery = req.query.limit;

  if (limitQuery === 'all') {
    return { isPaginated: false, page: 1, limit: 0, skip: 0 };
  }

  const limit = parseInt(limitQuery, 10) || 10;
  const skip = (page - 1) * limit;

  return { isPaginated: true, page, limit, skip };
};

const formatPaginatedResponse = (data, total, page, limit) => {
  if (limit === 0) {
    return {
      status: 200,
      pagination: {
        total,
        page: 1,
        limit: total,
        totalPages: 1,
      },
      data,
    };
  }

  const totalPages = Math.ceil(total / limit) || 1;
  return {
    status: 200,
    pagination: {
      total,
      page,
      limit,
      totalPages,
    },
    data,
  };
};

module.exports = {
  getPaginationParams,
  formatPaginatedResponse,
};
