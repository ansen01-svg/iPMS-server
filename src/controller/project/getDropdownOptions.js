import {
  districts,
  funds,
  natureOfWork,
  sanctionAndDepartment,
  typeOfWork,
} from "../../utils/constants.js";

const getDropdownOptions = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      data: {
        funds,
        sanctionAndDepartment,
        districts,
        typeOfWork,
        natureOfWork,
      },
    });
  } catch (error) {
    console.error("Error fetching dropdown options:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch dropdown options",
    });
  }
};

export default getDropdownOptions;
