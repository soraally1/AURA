import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { DailyForecast } from '@/types/zones';

interface SevenDaySymptomTimelineCardProps {
  dailyForecast: DailyForecast[];
  selectedDayIndex: number;
  onSelectDay: (index: number) => void;
  onPressAiAnalysis?: () => void;
}

interface TimelineSlot {
  id: string;
  time: string;
  title: string;
  subtitle: string;
  iconName: keyof typeof Ionicons.glyphMap;
  avatars: {
    icon: keyof typeof Ionicons.glyphMap;
    bg: string;
    color: string;
  }[];
}

const SHORT_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
];

const SHORT_DAY_MAP: Record<string, string> = {
  Senin: 'Sen',
  Selasa: 'Sel',
  Rabu: 'Rab',
  Kamis: 'Kam',
  Jumat: 'Jum',
  Sabtu: 'Sab',
  Minggu: 'Min',
};

function formatShortDate(dateStr?: string): string {
  if (!dateStr) return 'Hari Ini';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const year = parts[0];
  const monthIdx = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  return `${SHORT_MONTHS[monthIdx] || parts[1]} ${day}, ${year}`;
}

function getDayNumber(dateStr?: string, fallbackIndex = 0): string {
  if (!dateStr) return String(fallbackIndex + 1);
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return String(parseInt(parts[2], 10));
  }
  return dateStr.slice(-2);
}

function getShortDayName(dayName?: string, index = 0): string {
  if (!dayName) return ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'][index % 7];
  return SHORT_DAY_MAP[dayName] || dayName.slice(0, 3);
}

function buildVisualTimeline(day: DailyForecast): TimelineSlot[] {
  const aqi =
    day.predicted_aqi > 0
      ? day.predicted_aqi
      : Math.round(day.health_risk_score * 1.45);
  const isHighPollution = aqi >= 110 || day.predicted_pm2_5 >= 38;
  const isRainy = (day.precipitation_mm || 0) >= 3.0;
  const waterTarget = isHighPollution ? '2.5L air' : '2L air';
  const spfLabel = isRainy ? 'SPF 35+' : 'SPF 50+';

  return [
    {
      id: 'morning_water',
      time: '07:00',
      title: 'Minum Air Pagi',
      subtitle: 'Cegah dehidrasi & tenggorokan kering',
      iconName: 'water-outline',
      avatars: [
        { icon: 'water', bg: '#DBEAFE', color: '#1D4ED8' },
        { icon: 'sunny', bg: '#FEF3C7', color: '#D97706' },
        { icon: 'medkit', bg: '#DCFCE7', color: '#15803D' },
      ],
    },
    {
      id: 'morning_sunscreen',
      time: '09:00',
      title: `Pakai Sunscreen ${spfLabel}`,
      subtitle: 'Hindari kulit kusam & iritasi UV',
      iconName: 'sunny-outline',
      avatars: [
        { icon: 'sunny', bg: '#FEF3C7', color: '#D97706' },
        { icon: 'sparkles', bg: '#EDE9FE', color: '#7C3AED' },
        { icon: 'shield-checkmark', bg: '#DBEAFE', color: '#1D4ED8' },
      ],
    },
    {
      id: 'midday_peak',
      time: '12:30',
      title: isHighPollution ? 'Masker & Banyak Minum' : 'Banyak Minum & Berteduh',
      subtitle: isHighPollution
        ? `Target ${waterTarget}, hindari batuk & sesak napas`
        : `Target ${waterTarget}, hindari lemas & pusing panas`,
      iconName: 'shield-checkmark-outline',
      avatars: [
        { icon: 'water', bg: '#DBEAFE', color: '#1D4ED8' },
        { icon: 'sunny', bg: '#FEF3C7', color: '#D97706' },
        { icon: 'medical', bg: '#DCFCE7', color: '#15803D' },
        { icon: 'pulse', bg: '#FCE7F3', color: '#BE185D' },
      ],
    },
    {
      id: 'evening_cleanse',
      time: '19:30',
      title: 'Cuci Wajah & Istirahat',
      subtitle: 'Bersihkan sisa debu, cegah alergi & jerawat',
      iconName: 'sparkles-outline',
      avatars: [
        { icon: 'sparkles', bg: '#F3E8FF', color: '#6D28D9' },
        { icon: 'moon', bg: '#E0F2FE', color: '#0369A1' },
        { icon: 'heart', bg: '#FFE4E6', color: '#E11D48' },
      ],
    },
  ];
}

export const SevenDaySymptomTimelineCard: React.FC<
  SevenDaySymptomTimelineCardProps
> = ({
  dailyForecast,
  selectedDayIndex,
  onSelectDay,
  onPressAiAnalysis,
}) => {
  const selectedDay = dailyForecast[selectedDayIndex] || dailyForecast[0];
  const [slotByDay, setSlotByDay] = useState<Record<number, string>>({});
  const activeSlotId = slotByDay[selectedDayIndex] || 'midday_peak';
  const setActiveSlotId = (slotId: string) => {
    setSlotByDay((prev) => ({ ...prev, [selectedDayIndex]: slotId }));
  };

  const timelineSlots = useMemo(() => {
    if (!selectedDay) return [];
    return buildVisualTimeline(selectedDay);
  }, [selectedDay]);

  if (!selectedDay) return null;

  const dayTitle =
    selectedDayIndex === 0
      ? 'Hari Ini'
      : selectedDayIndex === 1
        ? 'Besok'
        : selectedDay.day_name;

  return (
    <View style={styles.cardContainer}>
      {/* Clean Minimal Header matching reference design */}
      <Text style={styles.dateText}>{formatShortDate(selectedDay.date)}</Text>
      <Text style={styles.todayHeading}>{dayTitle}</Text>

      {/* 7-Day Strip (Mon 4 .. Sat 9 .. Sun 10) */}
      <View style={styles.weekStripContainer}>
        {dailyForecast.slice(0, 7).map((item, idx) => {
          const isSelected = idx === selectedDayIndex;
          return (
            <Pressable
              key={item.date || idx}
              onPress={() => onSelectDay(idx)}
              style={styles.weekDayCol}
              hitSlop={8}
            >
              <Text
                style={[
                  styles.weekDayLabel,
                  isSelected && styles.weekDayLabelSelected,
                ]}
              >
                {getShortDayName(item.day_name, idx)}
              </Text>
              <Text
                style={[
                  styles.weekDayNumber,
                  isSelected && styles.weekDayNumberSelected,
                ]}
              >
                {getDayNumber(item.date, idx)}
              </Text>
              <View
                style={[
                  styles.weekDayDot,
                  isSelected && styles.weekDayDotSelected,
                ]}
              />
            </Pressable>
          );
        })}
      </View>

      {/* Vertical Visual Timeline */}
      <View style={styles.timelineList}>
        {timelineSlots.map((slot, index) => {
          const isFeatured = slot.id === activeSlotId;
          const isLast = index === timelineSlots.length - 1;

          return (
            <View key={slot.id} style={styles.timelineRow}>
              {/* Left Rail */}
              <View style={styles.timelineRailCol}>
                {isFeatured ? (
                  <View style={styles.nodeOuterActive}>
                    <View style={styles.nodeInnerActive} />
                  </View>
                ) : (
                  <View style={styles.nodeHollow} />
                )}
                {!isLast && <View style={styles.railLine} />}
              </View>

              {/* Right Card */}
              <View style={styles.timelineCardCol}>
                {isFeatured ? (
                  <Pressable onPress={() => setActiveSlotId(slot.id)}>
                    <LinearGradient
                      colors={['#4E97F7', '#3B82F6']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.featuredBlueCard}
                    >
                      <View style={styles.cardHeaderRow}>
                        <Text style={styles.featuredTitle}>{slot.title}</Text>
                        <Text style={styles.featuredTime}>{slot.time}</Text>
                      </View>

                      <Text style={styles.featuredDescription}>
                        {slot.subtitle}
                      </Text>

                      <View style={styles.featuredBottomRow}>
                        <View style={styles.avatarStackRow}>
                          {slot.avatars.map((av, aIdx) => (
                            <View
                              key={aIdx}
                              style={[
                                styles.avatarCircle,
                                {
                                  backgroundColor: av.bg,
                                  marginLeft: aIdx === 0 ? 0 : -6,
                                  zIndex: 10 - aIdx,
                                },
                              ]}
                            >
                              <Ionicons
                                name={av.icon}
                                size={14}
                                color={av.color}
                              />
                            </View>
                          ))}
                        </View>

                        <Pressable
                          onPress={onPressAiAnalysis}
                          style={styles.whiteActionSquircle}
                        >
                          <Ionicons
                            name={slot.iconName}
                            size={18}
                            color="#3B82F6"
                          />
                        </Pressable>
                      </View>
                    </LinearGradient>
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={() => setActiveSlotId(slot.id)}
                    style={styles.regularGrayCard}
                  >
                    <View style={styles.cardHeaderRow}>
                      <Text style={styles.regularTitle}>{slot.title}</Text>
                      <Text style={styles.regularTime}>{slot.time}</Text>
                    </View>
                    <Text numberOfLines={1} style={styles.regularDescription}>
                      {slot.subtitle}
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 16,
    marginTop: 14,
    marginBottom: 8,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  dateText: {
    fontSize: 13.5,
    fontWeight: '500',
    color: '#94A3B8',
    marginBottom: 2,
  },
  todayHeading: {
    fontSize: 30,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.6,
  },
  weekStripContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
    marginBottom: 20,
  },
  weekDayCol: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 36,
  },
  weekDayLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#94A3B8',
    marginBottom: 7,
  },
  weekDayLabelSelected: {
    color: '#3B82F6',
    fontWeight: '800',
  },
  weekDayNumber: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  weekDayNumberSelected: {
    color: '#3B82F6',
    fontWeight: '900',
  },
  weekDayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'transparent',
    marginTop: 4,
  },
  weekDayDotSelected: {
    backgroundColor: '#3B82F6',
  },
  timelineList: {
    marginTop: 2,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  timelineRailCol: {
    width: 24,
    alignItems: 'center',
    marginRight: 14,
  },
  nodeHollow: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#3B82F6',
    backgroundColor: '#FFFFFF',
    marginTop: 18,
  },
  nodeOuterActive: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#3B82F6',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  nodeInnerActive: {
    width: 11,
    height: 11,
    borderRadius: 5.5,
    backgroundColor: '#3B82F6',
  },
  railLine: {
    width: 1.8,
    flex: 1,
    backgroundColor: '#60A5FA',
    marginVertical: 4,
  },
  timelineCardCol: {
    flex: 1,
    paddingBottom: 14,
  },
  regularGrayCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    paddingVertical: 15,
    paddingHorizontal: 16,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  regularTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1E293B',
  },
  regularTime: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
  regularDescription: {
    fontSize: 12.5,
    color: '#94A3B8',
    fontWeight: '500',
  },
  featuredBlueCard: {
    borderRadius: 22,
    padding: 18,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 5,
  },
  featuredTitle: {
    fontSize: 16.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  featuredTime: {
    fontSize: 12.5,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
  },
  featuredDescription: {
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(255, 255, 255, 0.92)',
    marginTop: 4,
    marginBottom: 16,
  },
  featuredBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  avatarStackRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: '#4E97F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  whiteActionSquircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
