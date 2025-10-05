// User constants
export const userRoles = [
  "JE",
  "AEE",
  "CE",
  "MD",
  "VIEWER",
  "ADMIN",
  "OPERATOR",
];

// Project constants
export const projectStatus = [
  "Submitted for Approval",
  "Resubmitted for Approval",
  "Rejected by AEE",
  "Rejected by CE",
  "Rejected by MD",
  "Ongoing",
  "Completed",
];

export const funds = [
  {
    id: 0,
    name: "Central Fund",
    code: "CF",
    subFunds: [
      { id: 0, name: "CSS", code: "CSS" },
      { id: 1, name: "Article 275(1)", code: "Art 275" },
      { id: 2, name: "EMRS (NEST)", code: "EMRS" },
      { id: 3, name: "DAJGUA", code: "DAJGUA" },
      { id: 4, name: "Others", code: "Oth" },
    ],
  },
  {
    id: 1,
    name: "State Fund",
    code: "SF",
    subFunds: [
      { id: 0, name: "SOPD", code: "SOPD" },
      { id: 1, name: "FOIGS", code: "FOIGS" },
      { id: 2, name: "GIA", code: "GIA" },
      { id: 3, name: "Others", code: "Oth" },
    ],
  },
  {
    id: 2,
    name: "Private Fund",
    code: "PF",
    subFunds: [
      { id: 0, name: "Own Source", code: "OS" },
      { id: 1, name: "Others", code: "Oth" },
    ],
  },
];

export const sanctionAndDepartment = [
  "Department of Tribal Affairs, Plain",
  "Department of Education",
  "Department of Tea Tribes & Adivasi Welfare",
  "Department of Women & Child Development",
  "Department of Social Justice & Empowerment",
];

export const districts = [
  "Bajali",
  "Baksa",
  "Barpeta",
  "Biswanath",
  "Bongaigaon",
  "Cachar",
  "Charaideo",
  "Chirang",
  "Darrang",
  "Dhemaji",
  "Dhubri",
  "Dibrugarh",
  "Dima Hasao",
  "Goalpara",
  "Golaghat",
  "Hailakandi",
  "Hojai",
  "Jorhat",
  "Kamrup",
  "Kamrup Metropolitan",
  "Karbi Anglong",
  "Karimganj",
  "Kokrajhar",
  "Lakhimpur",
  "Majuli",
  "Morigaon",
  "Nagaon",
  "Nalbari",
  "Sivasagar",
  "Sonitpur",
  "South Salmara-Mankachar",
  "Tamulpur",
  "Tinsukia",
  "Udalguri",
  "West Karbi Anglong",
];

export const typeOfWork = [
  "Building Works",
  "Road Constuction",
  "Bridge Constuction",
  "Repairing/Renovation Works",
  "Upgradation Works",
  "Water Supply",
  "Internal Electrification",
  "Interior Works",
  "Boundary wall",
  "Land Development",
  "Landscaping",
  "Maintenance Works",
  "Upgradation Works",
  "Other developments",
];

export const natureOfWork = [
  "New Work",
  "Ongoing Work",
  "Maintenance Work",
  "Emergency Work",
];
