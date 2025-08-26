function validatePagination(page, limit) {
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);

  if (isNaN(pageNum) || pageNum < 1) {
    return "Page must be a positive integer";
  }

  if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
    return "Limit must be a positive integer between 1 and 100";
  }

  return null;
}
