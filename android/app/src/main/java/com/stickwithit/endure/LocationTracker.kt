package com.stickwithit.endure

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Bundle
import androidx.core.app.ActivityCompat
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.sqrt

data class RunningLocationPoint(
    val latitude: Double,
    val longitude: Double,
    val accuracy: Float,
    val timestamp: Long
)

data class LocationSample(
    val point: RunningLocationPoint,
    val distanceMeters: Double,
    val segmentMeters: Double,
    val speedKmh: Double
)

class LocationTracker(
    private val context: Context,
    private val onSample: (LocationSample) -> Unit,
    private val onRejected: (String) -> Unit
) : LocationListener {
    private val locationManager = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
    private var previousPoint: RunningLocationPoint? = null
    private var distanceMeters = 0.0

    fun start() {
        if (ActivityCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            onRejected("missing_permission")
            return
        }
        locationManager.requestLocationUpdates(LocationManager.GPS_PROVIDER, 2_000L, 2f, this)
    }

    fun stop() {
        locationManager.removeUpdates(this)
    }

    fun getDistanceMeters(): Double = distanceMeters

    override fun onLocationChanged(location: Location) {
        val next = RunningLocationPoint(
            latitude = location.latitude,
            longitude = location.longitude,
            accuracy = if (location.hasAccuracy()) location.accuracy else Float.MAX_VALUE,
            timestamp = if (location.time > 0) location.time else System.currentTimeMillis()
        )

        if (next.accuracy > 30f) {
            onRejected("low_accuracy")
            return
        }

        val previous = previousPoint
        if (previous == null) {
            previousPoint = next
            onSample(LocationSample(next, distanceMeters, 0.0, 0.0))
            return
        }

        val segmentMeters = haversineMeters(previous, next)
        if (segmentMeters < 5.0) {
            onRejected("too_short")
            return
        }

        val elapsedSeconds = ((next.timestamp - previous.timestamp).coerceAtLeast(1L)).toDouble() / 1000.0
        val speedKmh = (segmentMeters / 1000.0) / (elapsedSeconds / 3600.0)
        if (speedKmh > 31.0) {
            onRejected("too_fast")
            return
        }

        distanceMeters += segmentMeters
        previousPoint = next
        onSample(LocationSample(next, distanceMeters, segmentMeters, speedKmh))
    }

    override fun onProviderEnabled(provider: String) = Unit
    override fun onProviderDisabled(provider: String) = Unit
    @Deprecated("Deprecated in Java")
    override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) = Unit

    private fun haversineMeters(a: RunningLocationPoint, b: RunningLocationPoint): Double {
        val earthRadiusMeters = 6_371_000.0
        val dLat = Math.toRadians(b.latitude - a.latitude)
        val dLon = Math.toRadians(b.longitude - a.longitude)
        val lat1 = Math.toRadians(a.latitude)
        val lat2 = Math.toRadians(b.latitude)
        val h = sin(dLat / 2) * sin(dLat / 2) +
            cos(lat1) * cos(lat2) * sin(dLon / 2) * sin(dLon / 2)
        return 2 * earthRadiusMeters * atan2(sqrt(h), sqrt(1 - h))
    }
}
