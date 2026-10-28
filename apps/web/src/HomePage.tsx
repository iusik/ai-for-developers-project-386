import {
  Avatar,
  Button,
  Card,
  Container,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  IconCircleCheck,
  IconListDetails,
  IconMail,
  IconWorld,
} from '@tabler/icons-react';
import { owner } from './owner';

const features = [
  {
    icon: IconListDetails,
    title: 'Выбор типа звонка',
    description:
      'Короткое знакомство или подробный разговор — выберите формат и длительность.',
  },
  {
    icon: IconWorld,
    title: 'Свободное время в вашем поясе',
    description:
      'Слоты показываются в вашем часовом поясе — ничего не нужно пересчитывать.',
  },
  {
    icon: IconMail,
    title: 'Без регистрации',
    description: 'Достаточно имени и email.',
  },
  {
    icon: IconCircleCheck,
    title: 'Мгновенное подтверждение',
    description: 'Слот закрепляется за вами сразу после бронирования.',
  },
];

export function HomePage() {
  return (
    <Container size="lg" py="xl">
      <Stack align="center" gap="md" py="xl" ta="center">
        <Avatar src={owner.avatarUrl} alt={owner.name} size={120} />
        <Title order={1}>{owner.name}</Title>
        <Text size="lg" c="dimmed">
          Запишитесь на звонок со мной — без регистрации
        </Text>
        <Button component="a" href="/book" size="lg">
          Записаться
        </Button>
      </Stack>

      <Title order={2} mt="xl" mb="md">
        Возможности
      </Title>
      <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }}>
        {features.map(({ icon: Icon, title, description }) => (
          <Card key={title} withBorder radius="md" padding="lg">
            <ThemeIcon variant="light" size="lg" radius="md">
              <Icon size={20} />
            </ThemeIcon>
            <Title order={3} size="h4" mt="md">
              {title}
            </Title>
            <Text c="dimmed" mt="xs">
              {description}
            </Text>
          </Card>
        ))}
      </SimpleGrid>
    </Container>
  );
}
