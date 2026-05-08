console.log("parseFloat(null):", parseFloat(null));
console.log("parseFloat(0):", parseFloat(0));
try {
    console.log("parseFloat(null).toFixed(4):", parseFloat(null).toFixed(4));
} catch (e) {
    console.log("Error with parseFloat(null).toFixed(4):", e.message);
}
