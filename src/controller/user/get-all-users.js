import User from "../../models/user.model.js";

const getAllUsers = async (req, res) => {
  try {
    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Build filter object
    const filter = {};

    // Filter by designation (role)
    if (req.query.designation) {
      filter.designation = req.query.designation;
    }

    // Filter by department
    if (req.query.departmentId) {
      filter.departmentId = req.query.departmentId;
    }

    if (req.query.departmentName) {
      filter.departmentName = req.query.departmentName;
    }

    // Filter by roleId
    if (req.query.roleId) {
      filter.roleId = req.query.roleId;
    }

    // Filter by office location
    if (req.query.officeLocation) {
      filter.officeLocation = {
        $regex: req.query.officeLocation,
        $options: "i",
      };
    }

    // Filter by first login status
    if (req.query.isFirstLogin !== undefined) {
      filter.isFirstLogin = req.query.isFirstLogin === "true";
    }

    // Search functionality (searches across multiple fields)
    if (req.query.search) {
      const searchRegex = { $regex: req.query.search, $options: "i" };
      filter.$or = [
        { fullName: searchRegex },
        { username: searchRegex },
        { email: searchRegex },
        { phoneNumber: searchRegex },
        { userId: searchRegex },
      ];
    }

    // Sorting
    let sortOptions = { createdAt: -1 }; // Default sort

    if (req.query.sortBy) {
      const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;
      sortOptions = { [req.query.sortBy]: sortOrder };
    }

    // Execute queries
    const [users, totalUsers] = await Promise.all([
      User.find(filter)
        .sort(sortOptions)
        .limit(limit)
        .skip(skip)
        .select("-password"), // Exclude password even though toJSON handles it
      User.countDocuments(filter),
    ]);

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalUsers / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    res.json({
      success: true,
      data: users,
      pagination: {
        currentPage: page,
        totalPages,
        totalUsers,
        limit,
        hasNextPage,
        hasPrevPage,
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error fetching users",
      error: err.message,
    });
  }
};

export default getAllUsers;
