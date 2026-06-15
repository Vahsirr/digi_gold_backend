const mongoose = require('mongoose');

const CarouselImageSchema = new mongoose.Schema({
    imageUrl: { type: String, required: true },      // e.g. "/uploads/carousel/abc.jpg"
    title: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('CarouselImage', CarouselImageSchema);