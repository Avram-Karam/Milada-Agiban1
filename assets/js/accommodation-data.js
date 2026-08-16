/* accommodation-data.js — بيانات التسكين والغرف المستخرجة من صور المنظمين
   الدور الأول للولاد (Boys) والدور الثاني للبنات (Girls)
*/

const rooms = [
  /* ─── الدور الأول: ولاد (Floor 1) ─── */
  { id: "r101", name: "غرفة 101", floor: 1, capacity: 6, gender: "boys", persons: ["امير", "ابانوب سويحة", "جرجس", "سامح", "فيلو", "ابانوب"] },
  { id: "r102", name: "غرفة 102", floor: 1, capacity: 6, gender: "boys", persons: ["مينا", "كيرلس", "مارك", "يوسف", "جون", "بيشوي"] },
  { id: "r103", name: "غرفة 103", floor: 1, capacity: 6, gender: "boys", persons: ["شنودة", "بولا", "توني", "ديفيد", "ميكل", "رامي"] },
  { id: "r104", name: "غرفة 104", floor: 1, capacity: 6, gender: "boys", persons: [] },
  { id: "r105", name: "غرفة 105", floor: 1, capacity: 6, gender: "boys", persons: [] },
  { id: "r106", name: "غرفة 106", floor: 1, capacity: 6, gender: "boys", persons: [] },
  { id: "r107", name: "غرفة 107", floor: 1, capacity: 5, gender: "boys", persons: [] },
  { id: "r108", name: "غرفة 108", floor: 1, capacity: 3, gender: "boys", persons: [] },
  { id: "r109", name: "غرفة 109", floor: 1, capacity: 6, gender: "boys", persons: [] },
  { id: "r110", name: "غرفة 110", floor: 1, capacity: 4, gender: "boys", persons: [] },
  { id: "r111", name: "غرفة 111", floor: 1, capacity: 6, gender: "boys", persons: [] },
  { id: "r112", name: "غرفة 112", floor: 1, capacity: 6, gender: "boys", persons: [] },

  /* ─── الدور الثاني: بنات (Floor 2) ─── */
  { id: "r201", name: "غرفة 201", floor: 2, capacity: 6, gender: "girls", persons: ["مريم", "سارة", "يوستينا", "دميانة", "مارينا", "جيرمين"] },
  { id: "r202", name: "غرفة 202", floor: 2, capacity: 6, gender: "girls", persons: ["شيري", "ناردين", "ميرنا", "ساندرا", "كريستينا", "ميريت"] },
  { id: "r203", name: "غرفة 203", floor: 2, capacity: 6, gender: "girls", persons: [] },
  { id: "r204", name: "غرفة 204", floor: 2, capacity: 6, gender: "girls", persons: [] },
  { id: "r205", name: "غرفة 205", floor: 2, capacity: 6, gender: "girls", persons: [] },
  { id: "r206", name: "غرفة 206", floor: 2, capacity: 6, gender: "girls", persons: [] },
  { id: "r207", name: "غرفة 207", floor: 2, capacity: 6, gender: "girls", persons: [] },
  { id: "r208", name: "غرفة 208", floor: 2, capacity: 3, gender: "girls", persons: [] },
  { id: "r209", name: "غرفة 209", floor: 2, capacity: 5, gender: "girls", persons: [] },
  { id: "r210", name: "غرفة 210", floor: 2, capacity: 3, gender: "girls", persons: [] },
  { id: "r211", name: "غرفة 211", floor: 2, capacity: 6, gender: "girls", persons: [] },
  { id: "r212", name: "غرفة 212", floor: 2, capacity: 6, gender: "girls", persons: [] }
];

// تصدير البيانات للسكربت الرئيسي
window.rooms = rooms;
