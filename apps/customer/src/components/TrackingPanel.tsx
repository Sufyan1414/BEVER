import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from './AppText';
import MapView, { Marker, Polyline, UrlTile } from 'react-native-maps';
import { supabase } from '../services/supabase';

const ACTIVE = ['RIDER_ASSIGNED', 'RIDER_AT_STORE', 'PICKED_UP', 'OUT_FOR_DELIVERY'];

interface Tracking {
  status: string; rider_name: string | null; rider_phone: string | null;
  rider_lat: number | null; rider_lng: number | null; rider_updated_at: string | null;
  store_name: string; store_lat: number | null; store_lng: number | null; drop_lat: number | null; drop_lng: number | null;
}
interface Pt { latitude: number; longitude: number }

const toPt = (a: number | null | undefined, b: number | null | undefined): Pt | null => (typeof a === 'number' && typeof b === 'number' ? { latitude: a, longitude: b } : null);

async function fetchRoute(from: Pt, to: Pt): Promise<{ coords: Pt[]; minutes: number } | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from.longitude},${from.latitude};${to.longitude},${to.latitude}?overview=full&geometries=geojson`;
    const r = await fetch(url);
    if (!r.ok) return null;
    const j = await r.json();
    const route = j?.routes?.[0];
    if (!route) return null;
    const coords: Pt[] = (route.geometry.coordinates as [number, number][]).map(([lng, lat]) => ({ latitude: lat, longitude: lng }));
    return { coords, minutes: Math.max(1, Math.round(route.duration / 60)) };
  } catch { return null; }
}

/** Live map for an order in the delivery phase: rider position, route, ETA, call button. */
export function TrackingPanel({ orderId, status }: { orderId: string; status: string }) {
  const [t, setT] = useState<Tracking | null>(null);
  const [route, setRoute] = useState<{ coords: Pt[]; minutes: number } | null>(null);
  const mapRef = useRef<MapView | null>(null);
  const lastRouteAt = useRef(0);
  const active = ACTIVE.includes(status);

  const pull = useCallback(async () => {
    const { data } = await supabase.rpc('get_order_tracking', { p_order_id: orderId });
    const row = Array.isArray(data) ? data[0] : null;
    if (row) setT(row as Tracking);
  }, [orderId]);

  useEffect(() => {
    if (!active) return;
    void pull();
    const id = setInterval(() => { void pull(); }, 8000);
    return () => clearInterval(id);
  }, [active, pull]);

  const rider: Pt | null = toPt(t?.rider_lat, t?.rider_lng);
  const store: Pt | null = toPt(t?.store_lat, t?.store_lng);
  const drop: Pt | null = toPt(t?.drop_lat, t?.drop_lng);
  const toStore = status === 'RIDER_ASSIGNED' || status === 'RIDER_AT_STORE';
  const target = toStore ? store : drop;

  useEffect(() => {
    if (!rider || !target) return;
    if (Date.now() - lastRouteAt.current < 20000) return;
    lastRouteAt.current = Date.now();
    void fetchRoute(rider, target).then((r) => { if (r) setRoute(r); });
  }, [rider?.latitude, rider?.longitude, target?.latitude, target?.longitude]);

  useEffect(() => {
    const pts = [rider, store, drop].filter(Boolean) as Pt[];
    if (pts.length >= 2) mapRef.current?.fitToCoordinates(pts, { edgePadding: { top: 60, right: 60, bottom: 60, left: 60 }, animated: true });
  }, [rider?.latitude, rider?.longitude, store?.latitude, drop?.latitude]);

  if (!active || !t) return null;
  const center = rider ?? drop ?? store;
  if (!center) return null;

  const headline = status === 'OUT_FOR_DELIVERY' || status === 'PICKED_UP'
    ? (route ? `Arriving in ${route.minutes} min` : 'On the way to you')
    : status === 'RIDER_AT_STORE' ? 'Collecting your order' : (route ? `Rider reaches the shop in ${route.minutes} min` : 'Rider is heading to the shop');
  const message = status === 'OUT_FOR_DELIVERY' || status === 'PICKED_UP' ? 'I have picked up your order and I am on the way to your location.'
    : status === 'RIDER_AT_STORE' ? 'I am at the shop and collecting your order.' : 'I have accepted your order and I am heading to the shop.';

  return (
    <View style={s.wrap}>
      <View style={s.banner}><Text style={s.bannerSmall}>Order is on the way</Text><Text style={s.bannerBig}>{headline}</Text></View>
      <View style={s.mapBox}>
        <MapView
          ref={mapRef}
          style={s.map}
          initialRegion={{ latitude: center.latitude, longitude: center.longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 }}
          mapType={Platform.OS === 'android' ? 'none' : 'standard'}
          rotateEnabled={false} pitchEnabled={false} toolbarEnabled={false}
        >
          <UrlTile urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maximumZ={19} tileSize={256} doubleTileSize />
          {route ? <Polyline coordinates={route.coords} strokeColor="#059669" strokeWidth={5} /> : null}
          {store ? <Marker coordinate={store} title={t.store_name}><View style={s.pinStore}><Text style={{ fontSize: 18 }}>🏪</Text></View></Marker> : null}
          {drop ? <Marker coordinate={drop} title="Your location"><View style={s.pinDrop}><Text style={{ fontSize: 18 }}>📍</Text></View></Marker> : null}
          {rider ? <Marker coordinate={rider} title="Your rider"><View style={s.pinRider}><Text style={{ fontSize: 20 }}>🛵</Text></View></Marker> : null}
        </MapView>
        {!rider ? <View style={s.waiting}><Text style={s.waitingText}>Waiting for the rider’s live location…</Text></View> : null}
      </View>
      <View style={s.card}>
        <View style={s.avatar}><Text style={{ fontSize: 22 }}>🛵</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={s.name}>{t.rider_name ? `I’m ${t.rider_name}, your delivery partner` : 'Your delivery partner'}</Text>
          <View style={s.msg}><Text style={s.msgText}>{message}</Text></View>
        </View>
        {t.rider_phone ? (
          <TouchableOpacity style={s.call} onPress={() => { void Linking.openURL('tel:' + t.rider_phone); }} accessibilityLabel="Call your delivery partner" accessibilityRole="button">
            <Text style={{ fontSize: 18 }}>📞</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginBottom: 14 },
  banner: { backgroundColor: '#064E3B', borderRadius: 20, paddingVertical: 14, alignItems: 'center', marginBottom: 10 },
  bannerSmall: { color: '#A7F3D0', fontSize: 13, fontWeight: '700' },
  bannerBig: { color: '#fff', fontSize: 24, fontWeight: '900', marginTop: 2 },
  mapBox: { height: 260, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#D1FAE5', backgroundColor: '#ECFDF5' },
  map: { flex: 1 },
  waiting: { position: 'absolute', left: 12, right: 12, bottom: 12, backgroundColor: 'rgba(255,255,255,0.94)', borderRadius: 12, padding: 10, alignItems: 'center' },
  waitingText: { fontSize: 12, color: '#047857', fontWeight: '700' },
  pinStore: { backgroundColor: '#fff', borderRadius: 18, padding: 4, borderWidth: 2, borderColor: '#059669' },
  pinDrop: { backgroundColor: '#fff', borderRadius: 18, padding: 4, borderWidth: 2, borderColor: '#F59E0B' },
  pinRider: { backgroundColor: '#fff', borderRadius: 22, padding: 5, borderWidth: 2, borderColor: '#064E3B' },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 20, padding: 14, marginTop: 10, borderWidth: 1, borderColor: '#D1FAE5' },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#ECFDF5', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  name: { fontSize: 15, fontWeight: '900', color: '#064E3B' },
  msg: { backgroundColor: '#ECFDF5', borderRadius: 10, padding: 8, marginTop: 6 },
  msgText: { fontSize: 12, color: '#047857', lineHeight: 17 },
  call: { width: 46, height: 46, borderRadius: 23, borderWidth: 1, borderColor: '#A7F3D0', backgroundColor: '#ECFDF5', alignItems: 'center', justifyContent: 'center', marginLeft: 10 },
});
