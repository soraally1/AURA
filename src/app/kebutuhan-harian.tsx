import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Dimensions,
  StatusBar,
  Platform,
  Modal,
  StyleSheet,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_GAP = 12;
const CONTAINER_PADDING = 16;
const CARD_WIDTH = (SCREEN_WIDTH - CONTAINER_PADDING * 2 - CARD_GAP) / 2;

export interface DailyNeedItem {
  id: string;
  name: string;
  category: 'Anti panas' | 'Anti polusi' | 'Skincare' | 'Tetap hidrasi' | 'Pernapasan';
  badge: string;
  spec: string;
  rating: number;
  sold: string;
  price: number;
  image: any;
  isBestSeller?: boolean;
}

const PRODUCTS_DATA: DailyNeedItem[] = [
  {
    id: 'sunscreen',
    name: 'Sunscreen SPF 50+ PA++++',
    category: 'Anti panas',
    badge: 'Anti panas',
    spec: 'Perlindungan UV • 30 ml',
    rating: 4.9,
    sold: '1 rb+ terjual',
    price: 58000,
    image: require('@/assets/products/sunscreen.jpg'),
    isBestSeller: true,
  },
  {
    id: 'masker',
    name: 'Masker KN95 5 Lapis',
    category: 'Anti polusi',
    badge: 'Anti polusi',
    spec: 'Isi 10 pcs • Dewasa',
    rating: 4.9,
    sold: '2 rb+ terjual',
    price: 25000,
    image: require('@/assets/products/masker_kn95.jpg'),
    isBestSeller: true,
  },
  {
    id: 'ceramide',
    name: 'Ceramide Moisturizer',
    category: 'Skincare',
    badge: 'Skincare',
    spec: 'Jaga skin barrier • 50 g',
    rating: 4.8,
    sold: '850+ terjual',
    price: 69000,
    image: require('@/assets/products/ceramide.jpg'),
    isBestSeller: false,
  },
  {
    id: 'water_bottle',
    name: 'Botol Minum 750 ml',
    category: 'Tetap hidrasi',
    badge: 'Tetap hidrasi',
    spec: 'BPA-free • Mudah dibawa',
    rating: 4.8,
    sold: '620+ terjual',
    price: 45000,
    image: require('@/assets/products/water_bottle.jpg'),
    isBestSeller: false,
  },
  {
    id: 'nasal_spray',
    name: 'Saline Nasal Spray',
    category: 'Pernapasan',
    badge: 'Pernapasan',
    spec: 'Isotonik • 100 ml',
    rating: 4.9,
    sold: '430+ terjual',
    price: 85000,
    image: require('@/assets/products/nasal_spray.jpg'),
    isBestSeller: false,
  },
  {
    id: 'nebulizer',
    name: 'Nebulizer Portabel',
    category: 'Pernapasan',
    badge: 'Pernapasan',
    spec: 'Mesh • Praktis & ringkas',
    rating: 4.8,
    sold: '210+ terjual',
    price: 289000,
    image: require('@/assets/products/nebulizer.jpg'),
    isBestSeller: false,
  },
];

type CategoryFilter = 'All' | 'Anti panas' | 'Anti polusi' | 'Skincare' | 'Pernapasan';
type TabFilter = 'Semua' | 'Terlaris';
type SortOption = 'default' | 'price_asc' | 'price_desc' | 'rating';

export default function KebutuhanHarianScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('All');
  const [selectedTab, setSelectedTab] = useState<TabFilter>('Semua');
  const [sortOption, setSortOption] = useState<SortOption>('default');
  const [showSortModal, setShowSortModal] = useState(false);

  // Cart state: itemId -> quantity
  const [cart, setCart] = useState<Record<string, number>>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showCartModal, setShowCartModal] = useState(false);

  const totalCartCount = useMemo(() => {
    return Object.values(cart).reduce((sum, qty) => sum + qty, 0);
  }, [cart]);

  const totalCartPrice = useMemo(() => {
    return Object.entries(cart).reduce((sum, [id, qty]) => {
      const prod = PRODUCTS_DATA.find((p) => p.id === id);
      return sum + (prod ? prod.price * qty : 0);
    }, 0);
  }, [cart]);

  const handleAddToCart = (product: DailyNeedItem) => {
    setCart((prev) => ({
      ...prev,
      [product.id]: (prev[product.id] || 0) + 1,
    }));
    showToast(`"${product.name}" ditambahkan ke keranjang`);
  };

  const handleUpdateQuantity = (productId: string, delta: number) => {
    setCart((prev) => {
      const newQty = (prev[productId] || 0) + delta;
      if (newQty <= 0) {
        const copy = { ...prev };
        delete copy[productId];
        return copy;
      }
      return {
        ...prev,
        [productId]: newQty,
      };
    });
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  };

  // Filtered and sorted products
  const filteredProducts = useMemo(() => {
    let list = [...PRODUCTS_DATA];

    // Search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.category.toLowerCase().includes(query) ||
          p.spec.toLowerCase().includes(query)
      );
    }

    // Category
    if (selectedCategory !== 'All') {
      list = list.filter((p) => p.category === selectedCategory);
    }

    // Tab Filter
    if (selectedTab === 'Terlaris') {
      list = list.filter((p) => p.isBestSeller);
    }

    // Sorting
    if (sortOption === 'price_asc') {
      list.sort((a, b) => a.price - b.price);
    } else if (sortOption === 'price_desc') {
      list.sort((a, b) => b.price - a.price);
    } else if (sortOption === 'rating') {
      list.sort((a, b) => b.rating - a.rating);
    }

    return list;
  }, [searchQuery, selectedCategory, selectedTab, sortOption]);

  const formatRupiah = (val: number) => {
    return 'Rp' + val.toLocaleString('id-ID');
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* HEADER */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={24} color="#1E293B" />
        </Pressable>

        <Text style={styles.headerTitle}>Kebutuhan Harian</Text>

        {/* Cart Icon Button with dynamic Badge */}
        <Pressable
          onPress={() => setShowCartModal(true)}
          style={styles.cartButton}
          hitSlop={8}
        >
          <Ionicons name="cart-outline" size={20} color="#2563EB" />
          {totalCartCount > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{totalCartCount}</Text>
            </View>
          )}
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 24 },
        ]}
      >
        {/* SEARCH BAR */}
        <View style={styles.searchContainer}>
          <Ionicons
            name="search-outline"
            size={20}
            color="#3B82F6"
            style={styles.searchIcon}
          />
          <TextInput
            placeholder="Cari sunscreen, masker, dan lainnya"
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchInput}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')} hitSlop={10}>
              <Ionicons name="close-circle" size={18} color="#94A3B8" />
            </Pressable>
          )}
        </View>

        {/* HERO PROMO BANNER */}
        <View style={styles.heroBannerContainer}>
          <LinearGradient
            colors={['#38BDF8', '#2563EB', '#1D4ED8']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroBanner}
          >
            <View style={styles.heroBannerLeft}>
              <View style={styles.heroTagBadge}>
                <Text style={styles.heroTagText}>TEMAN AKTIVITASMU</Text>
              </View>

              <Text style={styles.heroTitle}>
                Tetap terlindungi,{'\n'}nyaman setiap hari.
              </Text>

              <Text style={styles.heroSubtitle}>
                Lengkapi kebutuhan untuk hadapi panas & polusi.
              </Text>
            </View>

            {/* Pill graphics / Floating capsules */}
            <View style={styles.heroImageWrapper}>
              <Image
                source={require('@/assets/homepage/Obat 1.png')}
                style={styles.heroImage}
                contentFit="contain"
              />
            </View>
          </LinearGradient>
        </View>

        {/* 4 CATEGORY QUICK FILTERS */}
        <View style={styles.categoriesRow}>
          {/* Anti Panas */}
          <Pressable
            onPress={() =>
              setSelectedCategory((prev) => (prev === 'Anti panas' ? 'All' : 'Anti panas'))
            }
            style={[
              styles.categoryCard,
              selectedCategory === 'Anti panas' && styles.categoryCardSelected,
            ]}
          >
            <View style={[styles.categoryIconCircle, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="sunny" size={22} color="#D97706" />
            </View>
            <Text
              style={[
                styles.categoryLabel,
                selectedCategory === 'Anti panas' && styles.categoryLabelSelected,
              ]}
            >
              Anti panas
            </Text>
          </Pressable>

          {/* Anti Polusi */}
          <Pressable
            onPress={() =>
              setSelectedCategory((prev) => (prev === 'Anti polusi' ? 'All' : 'Anti polusi'))
            }
            style={[
              styles.categoryCard,
              selectedCategory === 'Anti polusi' && styles.categoryCardSelected,
            ]}
          >
            <View style={[styles.categoryIconCircle, { backgroundColor: '#EFF6FF' }]}>
              <Ionicons name="shield-checkmark" size={20} color="#2563EB" />
            </View>
            <Text
              style={[
                styles.categoryLabel,
                selectedCategory === 'Anti polusi' && styles.categoryLabelSelected,
              ]}
            >
              Anti polusi
            </Text>
          </Pressable>

          {/* Skincare */}
          <Pressable
            onPress={() =>
              setSelectedCategory((prev) => (prev === 'Skincare' ? 'All' : 'Skincare'))
            }
            style={[
              styles.categoryCard,
              selectedCategory === 'Skincare' && styles.categoryCardSelected,
            ]}
          >
            <View style={[styles.categoryIconCircle, { backgroundColor: '#F3E8FF' }]}>
              <Ionicons name="water" size={21} color="#7C3AED" />
            </View>
            <Text
              style={[
                styles.categoryLabel,
                selectedCategory === 'Skincare' && styles.categoryLabelSelected,
              ]}
            >
              Skincare
            </Text>
          </Pressable>

          {/* Pernapasan */}
          <Pressable
            onPress={() =>
              setSelectedCategory((prev) => (prev === 'Pernapasan' ? 'All' : 'Pernapasan'))
            }
            style={[
              styles.categoryCard,
              selectedCategory === 'Pernapasan' && styles.categoryCardSelected,
            ]}
          >
            <View style={[styles.categoryIconCircle, { backgroundColor: '#ECFEFF' }]}>
              <MaterialCommunityIcons name="weather-windy" size={22} color="#0284C7" />
            </View>
            <Text
              style={[
                styles.categoryLabel,
                selectedCategory === 'Pernapasan' && styles.categoryLabelSelected,
              ]}
            >
              Pernapasan
            </Text>
          </Pressable>
        </View>

        {/* SECTION HEADER & TABS */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Pilihan untuk kamu</Text>
          <Text style={styles.sectionSubtitle}>
            Dari perlindungan diri sampai perawatan harian.
          </Text>

          <View style={styles.filterActionsRow}>
            <View style={styles.chipsRow}>
              <Pressable
                onPress={() => {
                  setSelectedTab('Semua');
                  setSelectedCategory('All');
                }}
                style={[
                  styles.filterChip,
                  selectedTab === 'Semua' && selectedCategory === 'All' && styles.filterChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    selectedTab === 'Semua' && selectedCategory === 'All' && styles.filterChipTextActive,
                  ]}
                >
                  Semua
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setSelectedTab('Terlaris')}
                style={[
                  styles.filterChip,
                  selectedTab === 'Terlaris' && styles.filterChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    selectedTab === 'Terlaris' && styles.filterChipTextActive,
                  ]}
                >
                  Terlaris
                </Text>
              </Pressable>
            </View>

            {/* Sort Button */}
            <Pressable
              onPress={() => setShowSortModal(true)}
              style={styles.sortButton}
            >
              <MaterialCommunityIcons name="tune-variant" size={17} color="#64748B" />
              <Text style={styles.sortButtonText}>Urutkan</Text>
            </Pressable>
          </View>
        </View>

        {/* PRODUCT GRID (2 COLUMNS) */}
        {filteredProducts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="basket-outline" size={48} color="#94A3B8" />
            <Text style={styles.emptyTitle}>Produk tidak ditemukan</Text>
            <Text style={styles.emptySubtitle}>
              Coba ganti kata kunci pencarian atau reset filter.
            </Text>
            <Pressable
              onPress={() => {
                setSearchQuery('');
                setSelectedCategory('All');
                setSelectedTab('Semua');
              }}
              style={styles.resetFilterButton}
            >
              <Text style={styles.resetFilterButtonText}>Reset Filter</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.productGrid}>
            {filteredProducts.map((item) => (
              <View key={item.id} style={styles.productCard}>
                {/* Image Container with Category Badge */}
                <View style={styles.productImageWrapper}>
                  <Image
                    source={item.image}
                    style={styles.productImage}
                    contentFit="cover"
                  />
                  {/* Category Pill Tag */}
                  <View style={styles.productBadge}>
                    <Text style={styles.productBadgeText}>{item.badge}</Text>
                  </View>
                </View>

                {/* Details */}
                <View style={styles.productInfo}>
                  <Text style={styles.productTitle} numberOfLines={2}>
                    {item.name}
                  </Text>
                  <Text style={styles.productSpec} numberOfLines={1}>
                    {item.spec}
                  </Text>

                  {/* Rating & Sold */}
                  <View style={styles.productMetaRow}>
                    <Ionicons name="star" size={13} color="#EAB308" />
                    <Text style={styles.productRating}>
                      {item.rating.toString().replace('.', ',')}
                    </Text>
                    <Text style={styles.metaDivider}>•</Text>
                    <Text style={styles.productSold}>{item.sold}</Text>
                  </View>

                  {/* Price & Add to cart Button */}
                  <View style={styles.productBottomRow}>
                    <Text style={styles.productPrice}>{formatRupiah(item.price)}</Text>
                    <Pressable
                      onPress={() => handleAddToCart(item)}
                      style={({ pressed }) => [
                        styles.addCartButton,
                        pressed && styles.addCartButtonPressed,
                      ]}
                      hitSlop={4}
                    >
                      <Ionicons name="add" size={20} color="#FFFFFF" />
                    </Pressable>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* BOTTOM NOTICE / ADVICE CARD */}
        <View style={styles.noticeCard}>
          <Ionicons
            name="checkmark-circle-outline"
            size={22}
            color="#2563EB"
            style={styles.noticeIcon}
          />
          <View style={styles.noticeContent}>
            <Text style={styles.noticeTitle}>Rawat diri dengan tepat</Text>
            <Text style={styles.noticeSubtitle}>
              Gunakan sesuai petunjuk. Untuk nebulizer dan keluhan pernapasan, konsultasikan ke dokter.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* TOAST FEEDBACK NOTIFICATION */}
      {toastMessage && (
        <View style={[styles.toastContainer, { bottom: insets.bottom + 16 }]}>
          <Ionicons name="checkmark-circle" size={18} color="#10B981" />
          <Text style={styles.toastText} numberOfLines={1}>
            {toastMessage}
          </Text>
        </View>
      )}

      {/* SORT MODAL */}
      <Modal
        visible={showSortModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSortModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowSortModal(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Urutkan Berdasarkan</Text>

            <Pressable
              onPress={() => {
                setSortOption('default');
                setShowSortModal(false);
              }}
              style={styles.sortOptionItem}
            >
              <Text
                style={[
                  styles.sortOptionText,
                  sortOption === 'default' && styles.sortOptionTextActive,
                ]}
              >
                Paling Sesuai
              </Text>
              {sortOption === 'default' && (
                <Ionicons name="checkmark" size={18} color="#2563EB" />
              )}
            </Pressable>

            <Pressable
              onPress={() => {
                setSortOption('price_asc');
                setShowSortModal(false);
              }}
              style={styles.sortOptionItem}
            >
              <Text
                style={[
                  styles.sortOptionText,
                  sortOption === 'price_asc' && styles.sortOptionTextActive,
                ]}
              >
                Harga Terendah
              </Text>
              {sortOption === 'price_asc' && (
                <Ionicons name="checkmark" size={18} color="#2563EB" />
              )}
            </Pressable>

            <Pressable
              onPress={() => {
                setSortOption('price_desc');
                setShowSortModal(false);
              }}
              style={styles.sortOptionItem}
            >
              <Text
                style={[
                  styles.sortOptionText,
                  sortOption === 'price_desc' && styles.sortOptionTextActive,
                ]}
              >
                Harga Tertinggi
              </Text>
              {sortOption === 'price_desc' && (
                <Ionicons name="checkmark" size={18} color="#2563EB" />
              )}
            </Pressable>

            <Pressable
              onPress={() => {
                setSortOption('rating');
                setShowSortModal(false);
              }}
              style={styles.sortOptionItem}
            >
              <Text
                style={[
                  styles.sortOptionText,
                  sortOption === 'rating' && styles.sortOptionTextActive,
                ]}
              >
                Rating Tertinggi
              </Text>
              {sortOption === 'rating' && (
                <Ionicons name="checkmark" size={18} color="#2563EB" />
              )}
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* CART SUMMARY MODAL */}
      <Modal
        visible={showCartModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCartModal(false)}
      >
        <View style={styles.cartModalOverlay}>
          <Pressable
            style={styles.cartModalBackdrop}
            onPress={() => setShowCartModal(false)}
          />
          <View
            style={[
              styles.cartModalSheet,
              { paddingBottom: Math.max(insets.bottom, 20) },
            ]}
          >
            <View style={styles.cartModalHandle} />

            <View style={styles.cartModalHeader}>
              <Text style={styles.cartModalTitle}>Keranjang Kebutuhan</Text>
              <Pressable
                onPress={() => setShowCartModal(false)}
                hitSlop={10}
              >
                <Ionicons name="close" size={22} color="#64748B" />
              </Pressable>
            </View>

            {totalCartCount === 0 ? (
              <View style={styles.emptyCartBox}>
                <Ionicons name="cart-outline" size={48} color="#CBD5E1" />
                <Text style={styles.emptyCartTitle}>Keranjangmu masih kosong</Text>
                <Text style={styles.emptyCartSubtitle}>
                  Pilih produk kebutuhan harianmu untuk perlindungan optimal.
                </Text>
              </View>
            ) : (
              <ScrollView
                style={{ maxHeight: 320 }}
                showsVerticalScrollIndicator={false}
              >
                {Object.entries(cart).map(([productId, quantity]) => {
                  const item = PRODUCTS_DATA.find((p) => p.id === productId);
                  if (!item) return null;
                  return (
                    <View key={item.id} style={styles.cartItemRow}>
                      <Image
                        source={item.image}
                        style={styles.cartItemThumb}
                        contentFit="cover"
                      />
                      <View style={styles.cartItemDetails}>
                        <Text style={styles.cartItemName} numberOfLines={1}>
                          {item.name}
                        </Text>
                        <Text style={styles.cartItemPrice}>
                          {formatRupiah(item.price)}
                        </Text>
                      </View>
                      <View style={styles.cartStepper}>
                        <Pressable
                          onPress={() => handleUpdateQuantity(item.id, -1)}
                          style={styles.cartStepButton}
                        >
                          <Ionicons name="remove" size={16} color="#2563EB" />
                        </Pressable>
                        <Text style={styles.cartQuantity}>{quantity}</Text>
                        <Pressable
                          onPress={() => handleUpdateQuantity(item.id, 1)}
                          style={styles.cartStepButton}
                        >
                          <Ionicons name="add" size={16} color="#2563EB" />
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            )}

            {totalCartCount > 0 && (
              <View style={styles.cartSummaryFooter}>
                <View style={styles.totalPriceRow}>
                  <Text style={styles.totalPriceLabel}>Total Pembayaran</Text>
                  <Text style={styles.totalPriceValue}>
                    {formatRupiah(totalCartPrice)}
                  </Text>
                </View>
                <Pressable
                  onPress={() => {
                    setShowCartModal(false);
                    showToast('Pesanan berhasil dibuat!');
                    setCart({});
                  }}
                  style={styles.checkoutButton}
                >
                  <Text style={styles.checkoutButtonText}>
                    Beli Sekarang ({totalCartCount})
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1E293B',
    flex: 1,
    marginLeft: 8,
  },
  cartButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#EF4444',
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  cartBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  scrollContent: {
    paddingHorizontal: CONTAINER_PADDING,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 999,
    paddingHorizontal: 14,
    height: 44,
    marginTop: 4,
    marginBottom: 14,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#1E293B',
    paddingVertical: 0,
  },
  heroBannerContainer: {
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 4,
    marginBottom: 20,
  },
  heroBanner: {
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroBannerLeft: {
    flex: 1,
    paddingRight: 10,
  },
  heroTagBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  heroTagText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 23,
    letterSpacing: -0.2,
  },
  heroSubtitle: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 6,
    lineHeight: 16,
  },
  heroImageWrapper: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroImage: {
    width: 76,
    height: 76,
  },
  categoriesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  categoryCard: {
    alignItems: 'center',
    flex: 1,
  },
  categoryCardSelected: {
    transform: [{ scale: 1.04 }],
  },
  categoryIconCircle: {
    width: 54,
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  categoryLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
    textAlign: 'center',
  },
  categoryLabelSelected: {
    color: '#2563EB',
    fontWeight: '700',
  },
  sectionHeader: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  filterActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  chipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#EFF6FF',
  },
  filterChipActive: {
    backgroundColor: '#2563EB',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sortButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  productGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CARD_GAP,
  },
  productCard: {
    width: CARD_WIDTH,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 4,
  },
  productImageWrapper: {
    width: '100%',
    height: CARD_WIDTH * 0.95,
    backgroundColor: '#F8FAFC',
    position: 'relative',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  productBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    elevation: 1,
  },
  productBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  productInfo: {
    padding: 10,
  },
  productTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    minHeight: 34,
    lineHeight: 17,
  },
  productSpec: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 3,
  },
  productMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 4,
  },
  productRating: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E293B',
  },
  metaDivider: {
    fontSize: 10,
    color: '#94A3B8',
  },
  productSold: {
    fontSize: 11,
    color: '#64748B',
  },
  productBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  productPrice: {
    fontSize: 14,
    fontWeight: '800',
    color: '#2563EB',
  },
  addCartButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addCartButtonPressed: {
    backgroundColor: '#1D4ED8',
    transform: [{ scale: 0.94 }],
  },
  noticeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    borderRadius: 14,
    padding: 12,
    marginTop: 20,
    marginBottom: 8,
  },
  noticeIcon: {
    marginRight: 10,
    marginTop: 1,
  },
  noticeContent: {
    flex: 1,
  },
  noticeTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E3A8A',
  },
  noticeSubtitle: {
    fontSize: 11,
    color: '#3B82F6',
    marginTop: 2,
    lineHeight: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  resetFilterButton: {
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#2563EB',
  },
  resetFilterButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  toastContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: '#0F172A',
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalContent: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 14,
  },
  sortOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F1F5F9',
  },
  sortOptionText: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '500',
  },
  sortOptionTextActive: {
    color: '#2563EB',
    fontWeight: '700',
  },
  cartModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  cartModalBackdrop: {
    flex: 1,
  },
  cartModalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  cartModalHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  cartModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  cartModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  emptyCartBox: {
    alignItems: 'center',
    paddingVertical: 28,
  },
  emptyCartTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
    marginTop: 10,
  },
  emptyCartSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
    textAlign: 'center',
  },
  cartItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F1F5F9',
  },
  cartItemThumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
  },
  cartItemDetails: {
    flex: 1,
    marginLeft: 12,
  },
  cartItemName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  cartItemPrice: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
    marginTop: 2,
  },
  cartStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 999,
    paddingHorizontal: 4,
    paddingVertical: 2,
    gap: 8,
  },
  cartStepButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartQuantity: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
    minWidth: 16,
    textAlign: 'center',
  },
  cartSummaryFooter: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  totalPriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  totalPriceLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  totalPriceValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#2563EB',
  },
  checkoutButton: {
    backgroundColor: '#2563EB',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkoutButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
